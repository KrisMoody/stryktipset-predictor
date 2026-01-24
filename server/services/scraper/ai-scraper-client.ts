/**
 * Node.js client for AI Scraper Service
 * Communicates with the Python FastAPI service running Crawl4AI + Claude
 */

import type { GameType } from '~/types/game-types'

interface TokenUsage {
  input: number
  output: number
}

interface AIScraperResult {
  success: boolean
  data: unknown
  tokens: TokenUsage | null
  error: string | null
}

interface BatchScrapeRequest {
  url: string
  dataType: string
  gameType?: GameType
}

interface BatchScrapeResultItem {
  success: boolean
  data: unknown
  error: string | null
  url: string
  dataType: string
}

interface BatchScrapeResult {
  results: BatchScrapeResultItem[]
  total: number
  succeeded: number
  failed: number
}

interface RawScrapeResult {
  success: boolean
  data: unknown
  error: string | null
}

/**
 * Error categories for distinguishing transient vs service-level failures
 */
export type ErrorCategory = 'transient' | 'service-level' | 'unknown'

export class AIScraperClient {
  private baseUrl: string
  private timeout: number
  private healthCacheExpiry: number = 0
  private healthCacheValue: boolean = false
  private readonly HEALTH_CACHE_TTL = 30000 // 30 seconds

  constructor(baseUrl = 'http://localhost:8000') {
    this.baseUrl = baseUrl
    this.timeout = 60000 // 60 seconds - must be longer than Python crawler timeout (45s) + retry delay
  }

  /**
   * Categorize an error to distinguish transient failures from service-level issues
   * Browser lifecycle errors indicate the remote service needs a restart
   */
  categorizeError(error: string | null): ErrorCategory {
    if (!error) return 'unknown'

    // Browser lifecycle errors - service needs restart
    if (
      error.includes('Browser.new_context') ||
      error.includes('browser has been closed') ||
      error.includes('Target page, context or browser has been closed') ||
      error.includes('Target closed') ||
      error.includes('Browser closed')
    ) {
      return 'service-level'
    }

    // Transient errors - can retry
    if (
      error.includes('timeout') ||
      error.includes('Timeout') ||
      error.includes('ECONNREFUSED') ||
      error.includes('ENOTFOUND') ||
      error.includes('network')
    ) {
      return 'transient'
    }

    return 'unknown'
  }

  /**
   * Check if AI Scraper service is healthy (with brief caching to avoid repeated checks)
   */
  async isHealthy(): Promise<boolean> {
    const now = Date.now()

    // Return cached value if still valid
    if (now < this.healthCacheExpiry) {
      return this.healthCacheValue
    }

    // Perform actual health check
    const healthy = await this.healthCheck()

    // Cache the result
    this.healthCacheValue = healthy
    this.healthCacheExpiry = now + this.HEALTH_CACHE_TTL

    return healthy
  }

  /**
   * Invalidate health cache (call after service-level errors)
   */
  invalidateHealthCache(): void {
    this.healthCacheExpiry = 0
  }

  /**
   * Scrape data using AI extraction
   * @param url - URL to scrape
   * @param dataType - Type of data to extract (xStats, statistics, headToHead, news, matchInfo, table, lineup, analysis, oddset)
   * @param gameType - Optional game type for logging/context
   */
  async scrape(url: string, dataType: string, gameType?: GameType): Promise<AIScraperResult> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          data_type: dataType,
          game_type: gameType,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`AI Scraper returned ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      return result as AIScraperResult
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          data: null,
          tokens: null,
          error: 'Request timeout',
        }
      }

      return {
        success: false,
        data: null,
        tokens: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Scrape multiple URLs in parallel
   * More efficient than sequential scraping as it reuses browser instance
   * @param requests - Array of scrape requests with url, dataType, and optional gameType
   * @param maxConcurrent - Maximum concurrent requests (default 3 for rate limiting)
   */
  async scrapeBatch(requests: BatchScrapeRequest[], maxConcurrent = 3): Promise<BatchScrapeResult> {
    try {
      const controller = new AbortController()
      // Longer timeout for batch operations
      const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2)

      const response = await fetch(`${this.baseUrl}/scrape-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: requests.map(r => ({
            url: r.url,
            data_type: r.dataType,
            game_type: r.gameType,
          })),
          max_concurrent: maxConcurrent,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`AI Scraper batch returned ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      // Map snake_case back to camelCase
      return {
        results: result.results.map(
          (r: {
            success: boolean
            data: unknown
            error: string | null
            url: string
            data_type: string
          }) => ({
            success: r.success,
            data: r.data,
            error: r.error,
            url: r.url,
            dataType: r.data_type,
          })
        ),
        total: result.total,
        succeeded: result.succeeded,
        failed: result.failed,
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          results: requests.map(r => ({
            success: false,
            data: null,
            error: 'Request timeout',
            url: r.url,
            dataType: r.dataType,
          })),
          total: requests.length,
          succeeded: 0,
          failed: requests.length,
        }
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      return {
        results: requests.map(r => ({
          success: false,
          data: null,
          error: errorMsg,
          url: r.url,
          dataType: r.dataType,
        })),
        total: requests.length,
        succeeded: 0,
        failed: requests.length,
      }
    }
  }

  /**
   * Scrape raw JavaScript data from a page without AI extraction
   * Useful for extracting embedded JSON data like _svs.draw.data.draws
   * @param url - URL to scrape
   * @param jsExpression - JavaScript expression to evaluate (e.g., "window._svs?.draw?.data?.draws")
   */
  async scrapeRaw(url: string, jsExpression: string): Promise<RawScrapeResult> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(`${this.baseUrl}/scrape-raw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          js_expression: jsExpression,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`AI Scraper raw returned ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      return result as RawScrapeResult
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          data: null,
          error: 'Request timeout',
        }
      }

      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Check if AI Scraper service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return false
      }

      const health = await response.json()
      return health.status === 'ok'
    } catch {
      return false
    }
  }
}

// Export types
export type {
  AIScraperResult,
  BatchScrapeRequest,
  BatchScrapeResult,
  BatchScrapeResultItem,
  RawScrapeResult,
}

// Export factory function to create instance with custom URL
export function getAIScraperClient(baseUrl: string): AIScraperClient {
  return new AIScraperClient(baseUrl)
}

// For backward compatibility, export a default instance
export const aiScraperClient = new AIScraperClient()
