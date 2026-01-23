import type { Page, Locator } from 'playwright'
import { BaseScraper } from './base-scraper'
import type { NewsData, NewsArticle } from '~/types'

/**
 * Expert analysis data structure
 */
export interface ExpertAnalysis {
  authorName: string
  authorImage?: string
  recommendation: '1' | 'X' | '2' | '1X' | 'X2' | '12' | '1X2' | null
  analysis: string
  source: string
}

/**
 * Extended news data including expert analysis
 */
export interface ExtendedNewsData extends NewsData {
  expertAnalyses: ExpertAnalysis[]
}

/**
 * Scraper for News tab and Expert Analysis (Spelanalys)
 * Extracts both news articles and expert betting recommendations
 */
export class NewsScraper extends BaseScraper {
  /**
   * DOM-based scraping method
   * Supports all game types: stryktipset, europatipset, topptipset
   */
  async scrape(
    page: Page,
    _matchId: number,
    drawNumber: number,
    matchNumber: number,
    drawDate?: Date
  ): Promise<ExtendedNewsData | null> {
    try {
      this.log(`Starting news and expert analysis scraping for ${this.gameType}`)

      // Determine if this is a current or historic draw
      const isCurrent = !drawDate || this.isCurrentDraw(drawDate)

      // Build URL using URL Manager (correct domain and pattern for all game types)
      const url = this.buildUrl('news', {
        matchNumber,
        drawNumber,
        drawDate: drawDate || new Date(),
        isCurrent,
      })
      this.log(`Navigating to: ${url}`)
      await this.navigateTo(page, url)

      // First extract expert analyses from the main Matchinfo page (Spelanalys section)
      const expertAnalyses = await this.extractExpertAnalyses(page)

      // Then try to navigate to News tab for additional news
      // NOTE: Diagnostic showed NO dedicated news article containers exist on the page
      // The news structure is different - we try multiple approaches
      const newsTabSelector =
        '[data-test-id="statistic-menu-tt-news"], a[href*="/nyheter"], a:has-text("Nyheter"), button:has-text("Nyheter")'
      let articles: NewsArticle[] = []

      if (await this.elementExists(page, newsTabSelector)) {
        await this.clickTab(page, newsTabSelector)
        // Wait for news content to load
        // Structure: .route-statistics-news-article contains articles with:
        // - h2.news-article-headline, .news-article-header-author, time, .f-content
        try {
          await page.waitForSelector(
            '.route-statistics-news-article, .tipsen-side-nav-overflow article, article',
            { timeout: 10000 }
          )
          articles = await this.extractArticles(page)
        } catch {
          this.log('News content did not load, continuing with expert analyses only')
        }
      } else {
        this.log('News tab not found, continuing with expert analyses only')
      }

      const newsData: ExtendedNewsData = {
        articles,
        expertAnalyses,
      }

      this.log(
        `News scraping complete: ${articles.length} articles, ${expertAnalyses.length} expert analyses`
      )
      return newsData
    } catch (error) {
      this.log(`Error scraping news: ${error}`)
      return null
    }
  }

  /**
   * Extract expert analyses from the Spelanalys section
   * HTML structure: .match-info-match-analysis contains each expert's analysis
   */
  private async extractExpertAnalyses(page: Page): Promise<ExpertAnalysis[]> {
    const analyses: ExpertAnalysis[] = []

    try {
      // Find all expert analysis containers
      const analysisElements = await page.locator('.match-info-match-analysis').all()

      for (const element of analysisElements) {
        try {
          // Extract author name from .analysis-author-name
          const authorName = await element.locator('.analysis-author-name').textContent()

          // Extract author profile image
          const authorImage = await element.locator('.analysis-profile-picture').getAttribute('src')

          // Extract the analysis text from .analysis-body
          const analysisText = await element.locator('.analysis-body').textContent()

          // Extract recommendation from bet buttons
          // The selected recommendation has class .btn-bet-selected
          const recommendation = await this.extractRecommendation(element)

          if (authorName && analysisText) {
            analyses.push({
              authorName: authorName.trim(),
              authorImage: authorImage || undefined,
              recommendation,
              analysis: analysisText.trim(),
              source: 'Svenska Spel',
            })
          }
        } catch (innerError) {
          this.log(`Error extracting single expert analysis: ${innerError}`)
        }
      }

      this.log(`Extracted ${analyses.length} expert analyses`)
    } catch (error) {
      this.log(`Error extracting expert analyses: ${error}`)
    }

    return analyses
  }

  /**
   * Extract the recommended bet from analysis-bet-buttons
   * Looks for .btn-bet-selected to find which outcome(s) the expert recommends
   */
  private async extractRecommendation(element: Locator): Promise<ExpertAnalysis['recommendation']> {
    try {
      const betButtons = await element.locator('.analysis-bet-buttons .btn-bet').all()
      const selectedOutcomes: string[] = []

      for (const button of betButtons) {
        const isSelected = await button.evaluate((el: Element) =>
          el.classList.contains('btn-bet-selected')
        )

        if (isSelected) {
          const label = await button.locator('.btn-bet-label').textContent()
          if (label) {
            selectedOutcomes.push(label.trim())
          }
        }
      }

      // Convert selected outcomes to recommendation format
      if (selectedOutcomes.length === 0) return null
      if (selectedOutcomes.length === 1) {
        const outcome = selectedOutcomes[0]
        if (outcome === '1' || outcome === 'X' || outcome === '2') {
          return outcome
        }
      }
      if (selectedOutcomes.length === 2) {
        const sorted = selectedOutcomes.sort()
        if (sorted.includes('1') && sorted.includes('X')) return '1X'
        if (sorted.includes('X') && sorted.includes('2')) return 'X2'
        if (sorted.includes('1') && sorted.includes('2')) return '12'
      }
      if (selectedOutcomes.length === 3) return '1X2'

      return null
    } catch (error) {
      this.log(`Error extracting recommendation: ${error}`)
      return null
    }
  }

  /**
   * Extract news articles from the Nyheter tab
   *
   * Confirmed HTML Structure (from svenskaspel.se):
   * - .route-statistics-news-article - Article container (inside .tipsen-side-nav-overflow)
   * - h2.news-article-headline - Title
   * - .news-article-header-author - Author/source (e.g., "Everysport.com")
   * - .news-article-header-published time - Date with datetime attribute
   * - .f-content - Article content with <p> and <blockquote> elements
   */
  private async extractArticles(page: Page): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = []

    try {
      // Primary selector - confirmed to exist on news pages with content
      let articleElements = await page.locator('.route-statistics-news-article').all()

      // Fallback: Try generic article tag within the overflow container
      if (articleElements.length === 0) {
        articleElements = await page.locator('.tipsen-side-nav-overflow article').all()
      }

      // Last fallback: Any article tag
      if (articleElements.length === 0) {
        articleElements = await page.locator('article').all()
      }

      if (articleElements.length > 0) {
        for (const element of articleElements) {
          try {
            // Extract title from h2.news-article-headline
            const title = await element
              .locator('h2.news-article-headline, .news-article-headline, h2')
              .first()
              .textContent()

            // Extract author/source from .news-article-header-author
            let author: string | null = null
            try {
              author = await element.locator('.news-article-header-author').first().textContent()
            } catch {
              // Author not found, will use default
            }

            // Extract date from time element
            let dateText: string | null = null
            let dateAttr: string | null = null
            try {
              const timeElement = element
                .locator('.news-article-header-published time, time')
                .first()
              dateText = await timeElement.textContent()
              dateAttr = await timeElement.getAttribute('datetime')
            } catch {
              // Date not found
            }

            // Extract content from .f-content - paragraphs and blockquotes
            let content = ''
            try {
              const contentElement = element.locator('.f-content')
              const paragraphs = await contentElement.locator('p, blockquote').allTextContents()
              content = paragraphs
                .map(p => p.trim())
                .filter(p => p.length > 0)
                .join('\n\n')
            } catch {
              // Content not found
            }

            if (title) {
              articles.push({
                title: title.trim(),
                content: content?.trim() || undefined,
                date: dateText?.trim() || dateAttr || undefined,
                source: author?.trim() || 'Everysport.com',
              })
            }
          } catch (innerError) {
            this.log(`Error extracting single article: ${innerError}`)
          }
        }
      }

      this.log(`Found ${articles.length} news articles`)
    } catch (error) {
      this.log(`Error extracting articles: ${error}`)
    }

    return articles
  }
}
