/* eslint-disable @typescript-eslint/no-explicit-any -- Playwright page types and dynamic DOM data */
import type { Page } from 'playwright'
import { humanDelay, humanClick, detectRateLimit } from '../utils/human-behavior'
import { getRandomDelay } from '../scraper-config'
import { urlManager, type UrlBuildContext } from '../utils/url-manager'
import type { GameType } from '~/types/game-types'

export interface ScraperOptions {
  timeout?: number
  debug?: boolean
  gameType?: GameType
}

/**
 * Base scraper class with common functionality
 * Supports all game types: stryktipset, europatipset, topptipset
 */
export abstract class BaseScraper {
  protected timeout: number
  protected debug: boolean
  protected gameType: GameType

  constructor(options: ScraperOptions = {}) {
    this.timeout = options.timeout || 30000
    this.debug = options.debug || false
    this.gameType = options.gameType || 'stryktipset'
  }

  /**
   * Set the game type for URL building
   */
  setGameType(gameType: GameType): void {
    this.gameType = gameType
    this.log(`Game type set to: ${gameType}`)
  }

  /**
   * Build URL using the URL Manager
   * This ensures correct domain and URL patterns for all game types
   */
  protected buildUrl(dataType: string, context: Omit<UrlBuildContext, 'gameType'>): string {
    return urlManager.buildUrl(dataType, {
      ...context,
      gameType: this.gameType,
    })
  }

  /**
   * Check if a draw date is current (within last 7 days) or historic
   */
  protected isCurrentDraw(drawDate: Date): boolean {
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - drawDate.getTime()) / (1000 * 60 * 60 * 24))
    // Consider draws within the last 7 days as "current"
    return daysDiff <= 7
  }

  /**
   * Navigate to a URL with human-like behavior
   */
  protected async navigateTo(
    page: Page,
    url: string,
    options: { waitUntil?: 'domcontentloaded' | 'networkidle' } = {}
  ): Promise<void> {
    try {
      this.log(`Navigating to: ${url}`)

      const waitUntil = options.waitUntil || 'domcontentloaded'

      const response = await page.goto(url, {
        waitUntil,
        timeout: this.timeout,
      })

      // Check response status code
      const statusCode = response?.status()
      if (statusCode === 429) {
        throw new Error('Rate limit detected: HTTP 429')
      }
      if (statusCode && statusCode >= 400) {
        this.log(`Warning: Received HTTP ${statusCode} response`)
      }

      // Longer delay after page load to appear more human-like (3-5 seconds)
      await humanDelay(3000, 5000)

      // Check for rate limiting
      const rateLimitCheck = await detectRateLimit(page)
      if (rateLimitCheck.isRateLimited) {
        const reason = rateLimitCheck.reason || 'Unknown reason'
        this.log(`Rate limit detected: ${reason}`)
        throw new Error(`Rate limit detected: ${reason}`)
      }

      this.log('Page loaded successfully')
    } catch (error) {
      this.log(`Error navigating to ${url}: ${error}`)

      // Re-throw with more context
      if (error instanceof Error) {
        if (error.message.includes('Rate limit')) {
          throw error // Preserve rate limit errors
        }
        throw new Error(`Navigation failed: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * Click a tab with human-like behavior
   */
  protected async clickTab(page: Page, tabSelector: string): Promise<void> {
    try {
      this.log(`Clicking tab: ${tabSelector}`)

      await page.waitForSelector(tabSelector, { timeout: 10000 })
      await humanClick(page, tabSelector)

      // Wait for tab content to load
      await humanDelay(1000, 2000)

      this.log('Tab clicked successfully')
    } catch (error) {
      this.log(`Error clicking tab ${tabSelector}: ${error}`)
      throw error
    }
  }

  /**
   * Extract text content from selector
   */
  protected async extractText(page: Page, selector: string): Promise<string | null> {
    try {
      const element = await page.locator(selector)
      const text = await element.textContent()
      return text?.trim() || null
    } catch (error) {
      this.log(`Error extracting text from ${selector}: ${error}`)
      return null
    }
  }

  /**
   * Extract multiple text elements
   */
  protected async extractTextAll(page: Page, selector: string): Promise<string[]> {
    try {
      const elements = await page.locator(selector).all()
      const texts: string[] = []

      for (const element of elements) {
        const text = await element.textContent()
        if (text) {
          texts.push(text.trim())
        }
      }

      return texts
    } catch (error) {
      this.log(`Error extracting texts from ${selector}: ${error}`)
      return []
    }
  }

  /**
   * Check if element exists
   */
  protected async elementExists(page: Page, selector: string): Promise<boolean> {
    try {
      const count = await page.locator(selector).count()
      return count > 0
    } catch {
      return false
    }
  }

  /**
   * Navigate directly to URL (optimized for direct navigation)
   */
  protected async navigateToDirectUrl(url: string, page: Page): Promise<void> {
    try {
      this.log(`Direct navigation to: ${url}`)

      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 5000, // Shorter timeout for direct URLs
      })

      // Check response status code
      const statusCode = response?.status()
      if (statusCode === 429) {
        throw new Error('Rate limit detected: HTTP 429')
      }
      if (statusCode && statusCode >= 400) {
        throw new Error(`HTTP ${statusCode} error`)
      }

      // Shorter delay for direct navigation (1.5-2.5 seconds)
      const delay = getRandomDelay({ min: 1500, max: 2500 })
      await new Promise(resolve => setTimeout(resolve, delay))

      // Check for rate limiting
      const rateLimitCheck = await detectRateLimit(page)
      if (rateLimitCheck.isRateLimited) {
        throw new Error(`Rate limit detected: ${rateLimitCheck.reason}`)
      }

      this.log('Direct navigation successful')
    } catch (error) {
      this.log(`Direct navigation failed: ${error}`)
      throw error
    }
  }

  /**
   * Human-like delay (exposed for subclasses)
   */
  protected async humanDelay(min: number, max: number): Promise<void> {
    const delay = getRandomDelay({ min, max })
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  /**
   * Log message if debug is enabled
   */
  protected log(message: string): void {
    if (this.debug) {
      console.log(`[${this.constructor.name}] ${message}`)
    }
  }

  /**
   * Abstract method to be implemented by subclasses
   * Traditional scraping method (fallback)
   */
  abstract scrape(
    page: Page,
    matchId: number,
    drawNumber: number,
    matchNumber: number
  ): Promise<any>
}
