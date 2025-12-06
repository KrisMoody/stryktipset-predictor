import type { Page } from 'playwright'
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
   */
  async scrape(page: Page, matchId: number, drawNumber: number, matchNumber: number): Promise<ExtendedNewsData | null> {
    try {
      this.log('Starting news and expert analysis scraping')

      // Navigate to match page
      const url = `https://www.svenskaspel.se/stryktipset/${drawNumber}/${matchNumber}`
      await this.navigateTo(page, url)

      // First extract expert analyses from the main Matchinfo page (Spelanalys section)
      const expertAnalyses = await this.extractExpertAnalyses(page)

      // Then try to navigate to News tab for additional news
      const newsTabSelector = '[data-test-id="statistic-menu-tt-news"], a[href*="/nyheter"], a:has-text("Nyheter")'
      let articles: NewsArticle[] = []

      if (await this.elementExists(page, newsTabSelector)) {
        await this.clickTab(page, newsTabSelector)
        // Wait for news content to load - look for the actual news article container
        await page.waitForSelector('.route-statistics-news-article, [class*="news-article"]', { timeout: 10000 })
        articles = await this.extractArticles(page)
      }
      else {
        this.log('News tab not found, continuing with expert analyses only')
      }

      const newsData: ExtendedNewsData = {
        articles,
        expertAnalyses,
      }

      this.log(`News scraping complete: ${articles.length} articles, ${expertAnalyses.length} expert analyses`)
      return newsData
    }
    catch (error) {
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
        }
        catch (innerError) {
          this.log(`Error extracting single expert analysis: ${innerError}`)
        }
      }

      this.log(`Extracted ${analyses.length} expert analyses`)
    }
    catch (error) {
      this.log(`Error extracting expert analyses: ${error}`)
    }

    return analyses
  }

  /**
   * Extract the recommended bet from analysis-bet-buttons
   * Looks for .btn-bet-selected to find which outcome(s) the expert recommends
   */
  private async extractRecommendation(element: any): Promise<ExpertAnalysis['recommendation']> {
    try {
      const betButtons = await element.locator('.analysis-bet-buttons .btn-bet').all()
      const selectedOutcomes: string[] = []

      for (const button of betButtons) {
        const isSelected = await button.evaluate((el: Element) =>
          el.classList.contains('btn-bet-selected'),
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
    }
    catch (error) {
      this.log(`Error extracting recommendation: ${error}`)
      return null
    }
  }

  /**
   * Extract news articles from the Nyheter tab
   *
   * HTML Structure (from svenskaspel.se):
   * - .route-statistics-news-article - Article container
   * - .news-article-headline (h2) - Title
   * - .news-article-header-author - Author/source (e.g., "Everysport.com")
   * - .news-article-header-published time - Date with datetime attribute
   * - .f-content - Article content with <p> and <blockquote> elements
   */
  private async extractArticles(page: Page): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = []

    try {
      // Find news article containers
      const articleElements = await page.locator('.route-statistics-news-article').all()

      for (const element of articleElements) {
        try {
          // Extract title from .news-article-headline (h2)
          const title = await element.locator('.news-article-headline, h2.news-article-headline').textContent()

          // Extract author/source from .news-article-header-author
          const author = await element.locator('.news-article-header-author').textContent()

          // Extract date from .news-article-header-published time element
          const timeElement = element.locator('.news-article-header-published time')
          const dateText = await timeElement.textContent()
          const dateAttr = await timeElement.getAttribute('datetime')

          // Extract content from .f-content - get all paragraph text
          const contentElement = element.locator('.f-content')
          const paragraphs = await contentElement.locator('p').allTextContents()
          const content = paragraphs.join('\n\n')

          if (title) {
            articles.push({
              title: title.trim(),
              content: content?.trim() || undefined,
              date: dateText?.trim() || dateAttr || undefined,
              source: author?.trim() || 'Svenska Spel / TT',
            })
          }
        }
        catch (innerError) {
          this.log(`Error extracting single article: ${innerError}`)
        }
      }

      this.log(`Found ${articles.length} news articles`)
    }
    catch (error) {
      this.log(`Error extracting articles: ${error}`)
    }

    return articles
  }
}
