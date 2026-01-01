/* eslint-disable @typescript-eslint/no-explicit-any -- Playwright page types and dynamic scraped data */
import { prisma } from '~/server/utils/prisma'
import { browserManager } from './browser-manager'
import { XStatsScraper } from './tabs/xstats-scraper'
import { StatisticsScraper } from './tabs/statistics-scraper'
import { HeadToHeadScraper } from './tabs/head-to-head-scraper'
import { NewsScraper } from './tabs/news-scraper'
import { type AIScraperClient, getAIScraperClient } from './ai-scraper-client'
import { urlManager, type UrlBuildContext } from './utils/url-manager'
import { scraperAnalytics } from './scraper-analytics'
import { isRateLimitError } from './scraper-config'
import { recordAIUsage } from '~/server/utils/ai-usage-recorder'
import { captureScrapingError } from '~/server/utils/bugsnag-helpers'
import type { ScrapeOptions, ScrapeResult, ScrapingMethod, UrlPattern } from '~/types'
import { deepMergeScrapedData } from '~/server/utils/deep-merge'

/**
 * Hybrid scraper service using AI (Crawl4AI + Claude) with DOM fallback
 * Primary: AI extraction (fast, adaptable, low maintenance)
 * Fallback: DOM scraping (reliable backup)
 */
export class ScraperServiceV3 {
  private xStatsScraper: XStatsScraper
  private statisticsScraper: StatisticsScraper
  private headToHeadScraper: HeadToHeadScraper
  private newsScraper: NewsScraper
  private domainTested = false
  private enableAiScraper: boolean
  private aiScraperClient: AIScraperClient

  // Circuit breaker state for rate limiting (inherited from V2)
  private consecutiveRateLimits = 0
  private lastRateLimitTime: number | null = null
  private readonly MAX_CONSECUTIVE_RATE_LIMITS = 3
  private readonly CIRCUIT_BREAKER_COOLDOWN_MS = 60000 // 1 minute

  // Serverless environment detection - Playwright not available on Vercel
  private readonly isServerless = !!process.env.VERCEL

  constructor(enableAiScraper = false, aiScraperUrl = 'http://localhost:8000') {
    this.xStatsScraper = new XStatsScraper({ debug: true })
    this.statisticsScraper = new StatisticsScraper({ debug: true })
    this.headToHeadScraper = new HeadToHeadScraper({ debug: true })
    this.newsScraper = new NewsScraper({ debug: true })
    this.enableAiScraper = enableAiScraper
    this.aiScraperClient = getAIScraperClient(aiScraperUrl)
  }

  /**
   * Check if circuit breaker is open (too many rate limits)
   */
  private isCircuitBreakerOpen(): boolean {
    if (this.consecutiveRateLimits < this.MAX_CONSECUTIVE_RATE_LIMITS) {
      return false
    }

    // Check if cooldown period has passed
    if (this.lastRateLimitTime) {
      const timeSinceLastRateLimit = Date.now() - this.lastRateLimitTime
      if (timeSinceLastRateLimit > this.CIRCUIT_BREAKER_COOLDOWN_MS) {
        // Reset circuit breaker
        console.log('[Scraper Service V3] Circuit breaker cooldown complete, resetting')
        this.consecutiveRateLimits = 0
        this.lastRateLimitTime = null
        return false
      }
    }

    return true
  }

  /**
   * Record a rate limit occurrence
   */
  private recordRateLimit(): void {
    this.consecutiveRateLimits++
    this.lastRateLimitTime = Date.now()
    console.log(
      `[Scraper Service V3] Rate limit recorded (${this.consecutiveRateLimits}/${this.MAX_CONSECUTIVE_RATE_LIMITS})`
    )

    if (this.consecutiveRateLimits >= this.MAX_CONSECUTIVE_RATE_LIMITS) {
      console.error(
        `[Scraper Service V3] Circuit breaker OPEN - too many consecutive rate limits. Pausing for ${this.CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s`
      )
    }
  }

  /**
   * Reset circuit breaker on successful scrape
   */
  private resetCircuitBreaker(): void {
    if (this.consecutiveRateLimits > 0) {
      console.log('[Scraper Service V3] Successful scrape, resetting circuit breaker')
      this.consecutiveRateLimits = 0
      this.lastRateLimitTime = null
    }
  }

  /**
   * Check if AI scraper returned empty/null data (all fields null)
   * This triggers DOM fallback even when AI reports success
   */
  private _isEmptyData(data: any): boolean {
    if (!data) return true
    if (typeof data !== 'object') return false

    // Check if all top-level values are null/undefined/empty
    const values = Object.values(data)
    if (values.length === 0) return true

    return values.every(v => {
      if (v === null || v === undefined) return true
      if (Array.isArray(v) && v.length === 0) return true
      if (typeof v === 'object' && v !== null) {
        // Recursively check nested objects
        return this._isEmptyData(v)
      }
      return false
    })
  }

  /**
   * Main scraping method with AI-first, DOM-fallback strategy
   */
  async scrapeMatch(options: ScrapeOptions): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = []
    const startTime = Date.now()

    try {
      console.log(`[Scraper Service V3] Starting hybrid scrape for match ${options.matchId}`)

      // Get draw info to determine URL pattern
      const draw = await this.getDrawInfo(options.drawNumber, options.gameType)
      if (!draw) {
        throw new Error(`Draw ${options.drawNumber} not found`)
      }

      const urlContext: UrlBuildContext = {
        matchNumber: options.matchNumber,
        drawNumber: options.drawNumber,
        drawDate: new Date(draw.draw_date),
        isCurrent: draw.is_current,
        gameType: options.gameType || 'stryktipset',
      }

      // Set game type on all DOM scrapers
      const gameType = options.gameType || 'stryktipset'
      this.xStatsScraper.setGameType(gameType)
      this.statisticsScraper.setGameType(gameType)
      this.headToHeadScraper.setGameType(gameType)
      this.newsScraper.setGameType(gameType)

      const urlPattern: UrlPattern = draw.is_current ? 'current' : 'historic'
      console.log(
        `[Scraper Service V3] Using ${urlPattern} URL pattern for draw ${options.drawNumber}`
      )

      // Check circuit breaker before starting
      if (this.isCircuitBreakerOpen()) {
        const waitTime =
          this.CIRCUIT_BREAKER_COOLDOWN_MS - (Date.now() - (this.lastRateLimitTime || 0))
        console.error(
          `[Scraper Service V3] Circuit breaker is OPEN. Wait ${Math.ceil(waitTime / 1000)}s before retrying`
        )
        throw new Error('Circuit breaker open: too many recent rate limits')
      }

      // Scrape each data type
      for (const dataType of options.dataTypes) {
        // Check circuit breaker before each data type
        if (this.isCircuitBreakerOpen()) {
          console.error('[Scraper Service V3] Circuit breaker opened during scraping, stopping')
          break
        }

        const dataResult = await this.scrapeDataType(dataType, options, urlContext, urlPattern)
        results.push(dataResult)

        // Handle rate limits
        if (!dataResult.success && this.isRateLimitErrorResult(dataResult.error || '')) {
          this.recordRateLimit()
          console.log('[Scraper Service V3] Rate limit detected, stopping further scraping')
          break
        } else if (dataResult.success) {
          // Reset on success
          this.resetCircuitBreaker()
        }
      }

      const totalDuration = Date.now() - startTime
      console.log(`[Scraper Service V3] Completed scrape in ${totalDuration}ms`)

      // Log analytics summary periodically
      if (Math.random() < 0.1) {
        // 10% chance
        scraperAnalytics.logSummary()
      }

      return results
    } catch (error) {
      console.error(`[Scraper Service V3] Fatal error:`, error)

      // Report fatal error to Bugsnag
      captureScrapingError(error, {
        matchId: options.matchId,
        dataType: 'all',
        method: 'unknown',
        duration: Date.now() - startTime,
      })

      return [
        {
          success: false,
          matchId: options.matchId,
          dataType: 'all',
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
          timestamp: new Date(),
        },
      ]
    }
  }

  /**
   * Scrape a single data type with AI-first, DOM-fallback strategy
   */
  private async scrapeDataType(
    dataType: string,
    options: ScrapeOptions,
    urlContext: UrlBuildContext,
    urlPattern: UrlPattern
  ): Promise<ScrapeResult> {
    const startTime = Date.now()
    let data: any = null
    let method: ScrapingMethod = 'ai'
    let error: string | undefined

    try {
      // Log operation start
      await prisma.scrape_operations.create({
        data: {
          match_id: options.matchId,
          operation_type: dataType,
          status: 'started',
          started_at: new Date(),
        },
      })

      // Try AI scraping first (if enabled)
      // HeadToHead now supported via Crawl4AI with tab clicking JS
      const useAI = this.enableAiScraper

      if (useAI) {
        console.log(`[Scraper Service V3] Trying AI scraping for ${dataType}`)

        try {
          // Check if AI service is healthy
          const isHealthy = await this.aiScraperClient.healthCheck()
          if (!isHealthy) {
            console.warn(
              '[Scraper Service V3] AI scraper service is not healthy, falling back to DOM'
            )
          } else {
            // Build URL
            const url = urlManager.buildUrl(dataType, urlContext)

            // Call AI scraper with gameType
            const aiResult = await this.aiScraperClient.scrape(url, dataType, options.gameType)

            if (aiResult.success && aiResult.data && !this._isEmptyData(aiResult.data)) {
              data = aiResult.data
              method = 'ai'

              // Record token usage and cost
              if (aiResult.tokens) {
                const inputCost = (aiResult.tokens.input / 1_000_000) * 1
                const outputCost = (aiResult.tokens.output / 1_000_000) * 5
                const totalCost = inputCost + outputCost

                await recordAIUsage({
                  userId: options.userId,
                  model: 'claude-haiku-4-5',
                  inputTokens: aiResult.tokens.input,
                  outputTokens: aiResult.tokens.output,
                  cost: totalCost,
                  dataType,
                  success: true,
                }).catch(error => {
                  console.error('[Scraper Service V3] Failed to record AI usage:', error)
                })

                console.log(
                  `[Scraper Service V3] AI usage: ${aiResult.tokens.input} in, ${aiResult.tokens.output} out, $${totalCost.toFixed(6)}`
                )
              }

              console.log(`[Scraper Service V3] ✅ AI scraping succeeded for ${dataType}`)
            } else {
              // AI failed or returned empty data - will fall back to DOM
              const reason = !aiResult.success
                ? `error: ${aiResult.error}`
                : aiResult.data && this._isEmptyData(aiResult.data)
                  ? 'returned empty/null data'
                  : 'no data returned'
              console.log(
                `[Scraper Service V3] AI scraping failed for ${dataType} (${reason}), will try DOM fallback`
              )
              error = aiResult.error || 'AI extraction failed or returned empty data'

              // Record failed usage
              if (aiResult.tokens) {
                const inputCost = (aiResult.tokens.input / 1_000_000) * 1
                const outputCost = (aiResult.tokens.output / 1_000_000) * 5
                const totalCost = inputCost + outputCost

                await recordAIUsage({
                  userId: options.userId,
                  model: 'claude-haiku-4-5',
                  inputTokens: aiResult.tokens.input,
                  outputTokens: aiResult.tokens.output,
                  cost: totalCost,
                  dataType,
                  success: false,
                }).catch(error => {
                  console.error('[Scraper Service V3] Failed to record AI usage:', error)
                })
              }
            }
          }
        } catch (aiError) {
          console.log(`[Scraper Service V3] AI scraping exception for ${dataType}:`, aiError)
          error = aiError instanceof Error ? aiError.message : 'AI scraping exception'
        }
      }

      // Fallback to DOM scraping if AI failed or is disabled
      if (!data) {
        // Skip DOM fallback on serverless (Vercel) - Playwright binaries not available
        if (this.isServerless) {
          console.log(
            `[Scraper Service V3] Skipping DOM fallback on serverless (Playwright not available)`
          )
          error = error || 'AI scraping failed; DOM fallback unavailable on serverless'
        } else {
          console.log(`[Scraper Service V3] Falling back to DOM scraping for ${dataType}`)
          method = 'tab_clicking'

          try {
            // Initialize browser
            await browserManager.init()
            const page = await browserManager.getPage()

            // Use DOM scraper
            data = await this.scrapeWithDOM(page, dataType, options, urlContext)

            if (data) {
              console.log(`[Scraper Service V3] ✅ DOM scraping succeeded for ${dataType}`)
            } else {
              console.log(`[Scraper Service V3] ❌ DOM scraping returned no data for ${dataType}`)
              error = 'No data returned from DOM scraping'
            }

            // Close page and save cookies
            await page.close()
            await browserManager.saveCookies()
          } catch (domError) {
            console.error(`[Scraper Service V3] DOM scraping error for ${dataType}:`, domError)
            error = domError instanceof Error ? domError.message : 'DOM scraping error'

            // Report DOM scraping error to Bugsnag
            captureScrapingError(domError, {
              matchId: options.matchId,
              dataType,
              method: 'tab_clicking',
              duration: Date.now() - startTime,
            })
          }
        }
      }

      const duration = Date.now() - startTime

      // Record analytics
      scraperAnalytics.record({
        method,
        urlPattern,
        domain: urlManager.getCurrentDomain(),
        dataType,
        success: !!data,
        duration,
        error: data ? undefined : error,
      })

      if (data) {
        // Fetch existing data for merge (preserve non-null values)
        const existing = await prisma.match_scraped_data.findUnique({
          where: {
            match_id_data_type: {
              match_id: options.matchId,
              data_type: dataType,
            },
          },
          select: { data: true },
        })

        // Merge new data with existing, preserving non-null existing values
        const mergedData = deepMergeScrapedData(
          existing?.data as Record<string, unknown> | null,
          data as Record<string, unknown>
        )

        // Save merged data to database
        await prisma.match_scraped_data.upsert({
          where: {
            match_id_data_type: {
              match_id: options.matchId,
              data_type: dataType,
            },
          },
          update: {
            data: mergedData as any,
            scraped_at: new Date(),
          },
          create: {
            match_id: options.matchId,
            data_type: dataType,
            data: mergedData as any,
          },
        })

        // Log success
        await prisma.scrape_operations.create({
          data: {
            match_id: options.matchId,
            operation_type: dataType,
            status: 'success',
            duration_ms: duration,
            completed_at: new Date(),
          },
        })

        return {
          success: true,
          matchId: options.matchId,
          dataType,
          data,
          duration,
          timestamp: new Date(),
        }
      } else {
        // Log failure
        const isRateLimited = this.isRateLimitErrorResult(error || '')
        await prisma.scrape_operations.create({
          data: {
            match_id: options.matchId,
            operation_type: dataType,
            status: isRateLimited ? 'rate_limited' : 'failed',
            error_message: error,
            duration_ms: duration,
            completed_at: new Date(),
          },
        })

        return {
          success: false,
          matchId: options.matchId,
          dataType,
          error: error || 'No data returned',
          duration,
          timestamp: new Date(),
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isRateLimited = this.isRateLimitErrorResult(errorMessage)

      console.error(`[Scraper Service V3] Error scraping ${dataType}:`, error)

      // Report to Bugsnag (rate limits are captured as warnings)
      captureScrapingError(error, {
        matchId: options.matchId,
        dataType,
        method,
        duration,
      })

      // Log failure
      await prisma.scrape_operations.create({
        data: {
          match_id: options.matchId,
          operation_type: dataType,
          status: isRateLimited ? 'rate_limited' : 'failed',
          error_message: errorMessage,
          duration_ms: duration,
          completed_at: new Date(),
        },
      })

      // Record analytics
      scraperAnalytics.record({
        method,
        urlPattern,
        domain: urlManager.getCurrentDomain(),
        dataType,
        success: false,
        duration,
        error: errorMessage,
      })

      return {
        success: false,
        matchId: options.matchId,
        dataType,
        error: errorMessage,
        duration,
        timestamp: new Date(),
      }
    }
  }

  /**
   * Scrape using DOM (tab-clicking method)
   */
  private async scrapeWithDOM(
    page: any,
    dataType: string,
    options: ScrapeOptions,
    urlContext: UrlBuildContext
  ): Promise<any> {
    try {
      console.log(`[Scraper Service V3] Using DOM method for ${dataType}`)

      // Use the traditional scrape method from scrapers
      // All scrapers now accept drawDate as 5th parameter for URL building
      switch (dataType) {
        case 'xStats':
          return await this.xStatsScraper.scrape(
            page,
            options.matchId,
            options.drawNumber,
            options.matchNumber,
            urlContext.drawDate
          )
        case 'statistics':
          return await this.statisticsScraper.scrape(
            page,
            options.matchId,
            options.drawNumber,
            options.matchNumber,
            urlContext.drawDate
          )
        case 'headToHead':
          return await this.headToHeadScraper.scrape(
            page,
            options.matchId,
            options.drawNumber,
            options.matchNumber,
            urlContext.drawDate
          )
        case 'news':
          return await this.newsScraper.scrape(
            page,
            options.matchId,
            options.drawNumber,
            options.matchNumber,
            urlContext.drawDate
          )
        default:
          throw new Error(`Unknown data type: ${dataType}`)
      }
    } catch (error) {
      console.error(`[Scraper Service V3] DOM method failed:`, error)
      return null
    }
  }

  /**
   * Get draw info from database
   */
  private async getDrawInfo(
    drawNumber: number,
    gameType = 'stryktipset'
  ): Promise<{ draw_date: Date; is_current: boolean } | null> {
    try {
      return await prisma.draws.findUnique({
        where: { game_type_draw_number: { game_type: gameType, draw_number: drawNumber } },
        select: { draw_date: true, is_current: true },
      })
    } catch (error) {
      console.error('[Scraper Service V3] Error getting draw info:', error)
      return null
    }
  }

  /**
   * Check if error is rate limit
   */
  private isRateLimitErrorResult(error: string): boolean {
    return isRateLimitError(error)
  }
}

// Export factory function to create instance with runtime config
// Note: Cannot use singleton here because runtime config is not available at module load time
export function getScraperServiceV3(
  enableAiScraper: boolean,
  aiScraperUrl: string
): ScraperServiceV3 {
  return new ScraperServiceV3(enableAiScraper, aiScraperUrl)
}

// For backward compatibility, export a default instance (AI disabled by default)
export const scraperServiceV3 = new ScraperServiceV3(false, 'http://localhost:8000')
