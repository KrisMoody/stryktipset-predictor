import type { Page, Locator } from 'playwright'
import { BaseScraper } from './base-scraper'

/**
 * Expert/analyst information
 */
export interface DrawAnalyst {
  name: string
  imageUrl?: string
  description?: string
  isOmbud?: boolean // True if it's a betting shop (ombud)
}

/**
 * Single match prediction from an analyst
 */
export interface MatchPrediction {
  matchNumber: number
  matchTitle: string // e.g., "Leeds - Liverpool"
  analystName: string
  prediction: '1' | 'X' | '2' | '1X' | 'X2' | '12' | '1X2' | null
}

/**
 * Complete draw analysis data
 */
export interface DrawAnalysisData {
  title?: string // e.g., "Stryktipset 6/12"
  introduction?: string // Opening text/summary
  analysts: DrawAnalyst[]
  predictions: MatchPrediction[]
  analysisContent?: string // Full analysis text (spikarna, skrällen, etc.)
}

/**
 * Scraper for the Analys (Analysis) page
 * Extracts expert predictions and analysis for the entire draw
 *
 * HTML Structure:
 * - .route-play-draw-analyses - Main container
 * - .f-content h2 - Title (e.g., "Stryktipset 6/12")
 * - .f-content p - Introduction text
 * - .draw-analysis-author-container - Expert info sections
 * - .draw-analysis-author img - Expert profile image
 * - .draw-analysis-name - Expert name
 * - .draw_analysis_author__presentation span - Expert description
 * - .event-analyses - List of match predictions
 * - .pg_analyse__event - Single match prediction
 * - .pg_analyse__event__title - Match title with number
 * - .pg_analyse__event__info__prediction__title - Analyst name
 * - .pg_outcome--selected .pg_outcome__sign - Selected prediction (1/X/2)
 */
export class AnalysisScraper extends BaseScraper {
  /**
   * DOM-based scraping method
   * Supports all game types: stryktipset, europatipset, topptipset
   */
  async scrape(
    page: Page,
    _matchId: number,
    drawNumber: number,
    _matchNumber: number,
    drawDate?: Date
  ): Promise<DrawAnalysisData | null> {
    try {
      this.log(`Starting analysis scraping for ${this.gameType}`)

      // Determine if this is a current or historic draw
      const isCurrent = !drawDate || this.isCurrentDraw(drawDate)

      // Build URL using URL Manager (correct domain and pattern for all game types)
      const url = this.buildUrl('analysis', {
        matchNumber: 1, // Analysis page doesn't use matchNumber
        drawNumber,
        drawDate: drawDate || new Date(),
        isCurrent,
      })
      this.log(`Navigating to: ${url}`)
      await this.navigateTo(page, url)

      // Wait for the analysis content to load
      await page.waitForSelector('.route-play-draw-analyses, .draw-analysis-author-container', {
        timeout: 15000,
      })

      // Extract title and introduction
      const title = await this.extractText(page, '.route-play-draw-analyses .f-content h2')
      const introduction = await this.extractIntroduction(page)

      // Extract analysts
      const analysts = await this.extractAnalysts(page)

      // Extract match predictions
      const predictions = await this.extractPredictions(page)

      // Extract full analysis content
      const analysisContent = await this.extractAnalysisContent(page)

      const analysisData: DrawAnalysisData = {
        title: title || undefined,
        introduction,
        analysts,
        predictions,
        analysisContent,
      }

      this.log(
        `Analysis scraping complete: ${analysts.length} analysts, ${predictions.length} predictions`
      )
      return analysisData
    } catch (error) {
      this.log(`Error scraping analysis: ${error}`)
      return null
    }
  }

  /**
   * Extract introduction paragraph
   */
  private async extractIntroduction(page: Page): Promise<string | undefined> {
    try {
      const firstParagraph = await page
        .locator('.route-play-draw-analyses .f-content > .margin-bottom-2 p')
        .first()
        .textContent()
      return firstParagraph?.trim() || undefined
    } catch {
      return undefined
    }
  }

  /**
   * Extract analyst information
   */
  private async extractAnalysts(page: Page): Promise<DrawAnalyst[]> {
    const analysts: DrawAnalyst[] = []

    try {
      const authorContainers = await page.locator('.draw-analysis-author-container').all()

      for (const container of authorContainers) {
        try {
          // Get analyst name
          const name = await container.locator('.draw-analysis-name').textContent()

          // Get profile image
          const imageUrl = await container.locator('.draw-analysis-author img').getAttribute('src')

          // Get description from presentation span
          const description = await container
            .locator('.draw_analysis_author__presentation span')
            .textContent()

          // Check if it's an ombud (betting shop)
          const isOmbud = (await container.locator('.draw-analysis-author-link-button').count()) > 0

          if (name) {
            analysts.push({
              name: name.trim(),
              imageUrl: imageUrl || undefined,
              description: description?.trim() || undefined,
              isOmbud,
            })
          }
        } catch (innerError) {
          this.log(`Error extracting single analyst: ${innerError}`)
        }
      }

      this.log(`Extracted ${analysts.length} analysts`)
    } catch (error) {
      this.log(`Error extracting analysts: ${error}`)
    }

    return analysts
  }

  /**
   * Extract match predictions from all analysts
   */
  private async extractPredictions(page: Page): Promise<MatchPrediction[]> {
    const predictions: MatchPrediction[] = []

    try {
      const eventItems = await page.locator('.event-analyses').all()

      for (const item of eventItems) {
        try {
          // Get match title (e.g., "1 Leeds - Liverpool")
          const titleElement = await item.locator('.pg_analyse__event__title').textContent()

          if (!titleElement) continue

          // Parse match number and title
          const match = titleElement.match(/^(\d+)\s+(.+)$/)
          const matchNumber = match ? parseInt(match[1] || '0') : 0
          const matchTitle = match && match[2] ? match[2].trim() : titleElement.trim()

          // Get analyst name
          const analystName = await item
            .locator('.pg_analyse__event__info__prediction__title')
            .textContent()

          // Get selected prediction (1, X, or 2)
          const prediction = await this.extractPrediction(item)

          predictions.push({
            matchNumber,
            matchTitle,
            analystName: analystName?.trim() || 'Unknown',
            prediction,
          })
        } catch (innerError) {
          this.log(`Error extracting single prediction: ${innerError}`)
        }
      }

      this.log(`Extracted ${predictions.length} predictions`)
    } catch (error) {
      this.log(`Error extracting predictions: ${error}`)
    }

    return predictions
  }

  /**
   * Extract the selected prediction (1, X, 2, or combo) from a match item
   */
  private async extractPrediction(item: Locator): Promise<MatchPrediction['prediction']> {
    try {
      // Find all selected outcomes
      const selectedOutcomes = await item
        .locator('.pg_outcome--selected .pg_outcome__sign')
        .allTextContents()

      if (selectedOutcomes.length === 0) return null

      // Clean and sort the outcomes
      const cleaned = selectedOutcomes
        .map((o: string) => o.trim())
        .filter((o: string) => ['1', 'X', '2'].includes(o))

      if (cleaned.length === 1) {
        const outcome = cleaned[0]
        if (outcome === '1' || outcome === 'X' || outcome === '2') {
          return outcome
        }
      }

      if (cleaned.length === 2) {
        const sorted = cleaned.sort()
        if (sorted.includes('1') && sorted.includes('X')) return '1X'
        if (sorted.includes('X') && sorted.includes('2')) return 'X2'
        if (sorted.includes('1') && sorted.includes('2')) return '12'
      }

      if (cleaned.length === 3) return '1X2'

      return null
    } catch {
      return null
    }
  }

  /**
   * Extract full analysis content (spikarna, skrällen, etc.)
   */
  private async extractAnalysisContent(page: Page): Promise<string | undefined> {
    try {
      // Get the analysis sections (after the predictions list)
      const analysisSection = page.locator('.route-play-draw-analyses .f-content').last()

      if ((await analysisSection.count()) > 0) {
        // Get all text content from headings and paragraphs
        const headings = await analysisSection.locator('h2, h3, h4').allTextContents()
        const paragraphs = await analysisSection.locator('p').allTextContents()

        // Combine into structured content
        const content = [...headings, ...paragraphs].filter(text => text.trim()).join('\n\n')

        return content || undefined
      }
    } catch (error) {
      this.log(`Error extracting analysis content: ${error}`)
    }

    return undefined
  }
}
