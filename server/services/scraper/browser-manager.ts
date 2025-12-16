import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { cookieManager } from './cookie-manager'
import {
  configureAntiDetection,
  getRandomUserAgent,
  getRandomViewport,
  getRealisticHeaders,
} from './utils/fingerprint'

/**
 * Manages browser lifecycle and context for scraping
 */
export class BrowserManager {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private initializing: Promise<void> | null = null

  /**
   * Initialize browser with anti-detection measures
   */
  async init(): Promise<void> {
    // Fail fast on serverless - Playwright binaries are not available
    if (process.env.VERCEL) {
      throw new Error(
        'Browser automation is not available on Vercel. Use AI scraper service instead.'
      )
    }

    if (this.browser && this.context) {
      return
    }

    if (this.initializing) {
      await this.initializing
      return
    }

    this.initializing = (async () => {
      try {
        console.log('[Browser Manager] Launching browser...')

        // Launch browser with stealth settings
        this.browser = await chromium.launch({
          headless: true,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-web-security',
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
        })

        // Get random user agent and viewport
        const userAgent = getRandomUserAgent()
        const viewport = getRandomViewport()

        console.log(`[Browser Manager] Using User-Agent: ${userAgent.substring(0, 50)}...`)
        console.log(`[Browser Manager] Using Viewport: ${viewport.width}x${viewport.height}`)

        // Create context with realistic settings
        this.context = await this.browser.newContext({
          userAgent,
          viewport,
          locale: 'sv-SE',
          timezoneId: 'Europe/Stockholm',
          permissions: [],
          extraHTTPHeaders: getRealisticHeaders(),
        })

        // Configure anti-detection
        await configureAntiDetection(this.context)

        // Try to load existing cookies
        await cookieManager.loadCookies(this.context)

        console.log('[Browser Manager] Browser initialized successfully')
      } catch (error) {
        console.error('[Browser Manager] Error initializing browser:', error)
        throw error
      } finally {
        this.initializing = null
      }
    })()

    await this.initializing
  }

  /**
   * Get or create a new page
   */
  async getPage(): Promise<Page> {
    if (!this.context) {
      await this.init()
    }

    const page = await this.context!.newPage()
    return page
  }

  /**
   * Save cookies from current context
   */
  async saveCookies(): Promise<void> {
    if (this.context) {
      await cookieManager.saveCookies(this.context)
    }
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    try {
      // Save cookies before closing
      if (this.context) {
        await this.saveCookies()
      }

      if (this.context) {
        await this.context.close()
        this.context = null
      }

      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }

      console.log('[Browser Manager] Browser closed')
    } catch (error) {
      console.error('[Browser Manager] Error closing browser:', error)
    }
  }

  /**
   * Check if browser is initialized
   */
  isInitialized(): boolean {
    return this.browser !== null && this.context !== null
  }
}

// Export singleton instance
export const browserManager = new BrowserManager()
