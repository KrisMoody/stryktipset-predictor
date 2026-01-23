import type { Page } from 'playwright'
import type { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { browserManager } from './browser-manager'
import { scraperQueue } from './scraper-queue'
import { XStatsScraper } from './tabs/xstats-scraper'
import { StatisticsScraper } from './tabs/statistics-scraper'
import { HeadToHeadScraper } from './tabs/head-to-head-scraper'
import { NewsScraper } from './tabs/news-scraper'
import { humanDelay, performNaturalBehavior } from './utils/human-behavior'
import type { ScrapeOptions, ScrapeResult } from '~/types'

/**
 * Health metrics for scraper service
 */
interface HealthMetrics {
  last24Hours?: {
    success: number
    failed: number
    rateLimited: number
    total: number
    successRate: number
  }
  queue?: ReturnType<typeof scraperQueue.getStatus>
  browser?: {
    initialized: boolean
  }
  error?: string
}

/**
 * Main scraper service that coordinates all scraping operations
 */
export class ScraperService {
  private xStatsScraper: XStatsScraper
  private statisticsScraper: StatisticsScraper
  private headToHeadScraper: HeadToHeadScraper
  private newsScraper: NewsScraper

  constructor() {
    this.xStatsScraper = new XStatsScraper({ debug: true })
    this.statisticsScraper = new StatisticsScraper({ debug: true })
    this.headToHeadScraper = new HeadToHeadScraper({ debug: true })
    this.newsScraper = new NewsScraper({ debug: true })
  }

  /**
   * Check if an error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return (
        message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('too many requests')
      )
    }
    return false
  }

  /**
   * Scrape a single data type with retry logic
   */
  private async scrapeDataTypeWithRetry(
    page: Page,
    dataType: string,
    options: ScrapeOptions,
    maxRetries: number = 3
  ): Promise<{ data: unknown | null; duration: number; retryCount: number }> {
    let retryCount = 0
    let lastError: Error | null = null

    while (retryCount < maxRetries) {
      const dataStartTime = Date.now()

      try {
        let data = null

        switch (dataType) {
          case 'xStats':
            data = await this.xStatsScraper.scrape(
              page,
              options.matchId,
              options.drawNumber,
              options.matchNumber
            )
            break
          case 'statistics':
            data = await this.statisticsScraper.scrape(
              page,
              options.matchId,
              options.drawNumber,
              options.matchNumber
            )
            break
          case 'headToHead':
            data = await this.headToHeadScraper.scrape(
              page,
              options.matchId,
              options.drawNumber,
              options.matchNumber
            )
            break
          case 'news':
            data = await this.newsScraper.scrape(
              page,
              options.matchId,
              options.drawNumber,
              options.matchNumber
            )
            break
        }

        const duration = Date.now() - dataStartTime

        if (data) {
          return { data, duration, retryCount }
        } else {
          throw new Error(`No data returned for ${dataType}`)
        }
      } catch (error) {
        const duration = Date.now() - dataStartTime
        lastError = error instanceof Error ? error : new Error('Unknown error')
        const isRateLimited = this.isRateLimitError(error)

        retryCount++

        if (isRateLimited && retryCount < maxRetries) {
          // Exponential backoff for rate limits: 5s, 15s, 45s
          const backoffMs = 5000 * Math.pow(3, retryCount - 1)
          console.log(
            `[Scraper Service] Rate limit on ${dataType} (attempt ${retryCount}/${maxRetries}), waiting ${backoffMs / 1000}s before retry`
          )

          await prisma.scrape_operations.create({
            data: {
              match_id: options.matchId,
              operation_type: dataType,
              status: 'rate_limited',
              error_message: lastError.message,
              duration_ms: duration,
              retry_count: retryCount,
              completed_at: new Date(),
            },
          })

          await new Promise(resolve => setTimeout(resolve, backoffMs))

          // Perform natural behavior after waiting
          await performNaturalBehavior(page)
        } else if (!isRateLimited && retryCount < maxRetries) {
          // Regular error - shorter backoff: 2s, 4s, 8s
          const backoffMs = 2000 * Math.pow(2, retryCount - 1)
          console.log(
            `[Scraper Service] Error on ${dataType} (attempt ${retryCount}/${maxRetries}), waiting ${backoffMs / 1000}s before retry`
          )

          await new Promise(resolve => setTimeout(resolve, backoffMs))
        } else {
          // Max retries reached or non-retryable error
          throw lastError
        }
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error(`Failed after ${maxRetries} attempts`)
  }

  /**
   * Scrape match data
   */
  async scrapeMatch(options: ScrapeOptions): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = []
    const startTime = Date.now()

    try {
      console.log(`[Scraper Service] Starting scrape for match ${options.matchId}`)

      // Initialize browser
      await browserManager.init()
      const page = await browserManager.getPage()

      // Handle cookie consent on first page load
      await this.handleCookieConsent(page)

      // Perform natural behavior before scraping
      await performNaturalBehavior(page)

      // Scrape each requested data type with retry logic
      for (const dataType of options.dataTypes) {
        try {
          // Log operation start for realtime updates
          await prisma.scrape_operations.create({
            data: {
              match_id: options.matchId,
              operation_type: dataType,
              status: 'started',
              started_at: new Date(),
            },
          })

          const { data, duration, retryCount } = await this.scrapeDataTypeWithRetry(
            page,
            dataType,
            options
          )

          // Save to database
          await prisma.match_scraped_data.upsert({
            where: {
              match_id_data_type: {
                match_id: options.matchId,
                data_type: dataType,
              },
            },
            update: {
              data: data as unknown as Prisma.InputJsonValue,
              scraped_at: new Date(),
            },
            create: {
              match_id: options.matchId,
              data_type: dataType,
              data: data as unknown as Prisma.InputJsonValue,
            },
          })

          // Log success
          await prisma.scrape_operations.create({
            data: {
              match_id: options.matchId,
              operation_type: dataType,
              status: 'success',
              duration_ms: duration,
              retry_count: retryCount,
              completed_at: new Date(),
            },
          })

          results.push({
            success: true,
            matchId: options.matchId,
            dataType,
            data,
            duration,
            timestamp: new Date(),
          })

          console.log(
            `[Scraper Service] Successfully scraped ${dataType} for match ${options.matchId}${retryCount > 0 ? ` after ${retryCount} retries` : ''}`
          )

          // Longer delay between scraping different data types (3-5 seconds)
          await humanDelay(3000, 5000)

          // Add natural behavior between scrapers
          await performNaturalBehavior(page)
        } catch (error) {
          const isRateLimited = this.isRateLimitError(error)

          console.error(`[Scraper Service] Error scraping ${dataType} after all retries:`, error)

          // Log final failure with appropriate status
          const status = isRateLimited ? 'rate_limited' : 'failed'
          await prisma.scrape_operations.create({
            data: {
              match_id: options.matchId,
              operation_type: dataType,
              status,
              error_message: error instanceof Error ? error.message : 'Unknown error',
              duration_ms: 0,
              retry_count: 3,
              completed_at: new Date(),
            },
          })

          results.push({
            success: false,
            matchId: options.matchId,
            dataType,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: 0,
            timestamp: new Date(),
          })

          // If rate limited even after retries, stop trying other data types
          if (isRateLimited) {
            console.log(
              '[Scraper Service] Rate limit persists after retries, stopping further scraping for this match'
            )
            break
          }
        }
      }

      // Close page
      await page.close()

      // Save cookies
      await browserManager.saveCookies()

      const totalDuration = Date.now() - startTime
      console.log(
        `[Scraper Service] Completed scrape for match ${options.matchId} in ${totalDuration}ms`
      )

      return results
    } catch (error) {
      console.error(`[Scraper Service] Fatal error scraping match ${options.matchId}:`, error)

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
   * Handle cookie consent dialog
   */
  private async handleCookieConsent(page: Page): Promise<void> {
    try {
      // Wait for cookie dialog
      const cookieButtonSelector =
        'button:has-text("Acceptera"), button:has-text("Accept"), [id*="cookie"][class*="accept"]'

      const cookieButton = page.locator(cookieButtonSelector).first()
      if (await cookieButton.isVisible({ timeout: 5000 })) {
        console.log('[Scraper Service] Accepting cookie consent')
        await cookieButton.click()
        await humanDelay(1000, 2000)
      }
    } catch {
      // No cookie dialog or already handled - this is fine
      console.log('[Scraper Service] No cookie dialog found or already handled')
    }
  }

  /**
   * Queue a scraping task
   */
  async queueScrape(options: ScrapeOptions, priority: number = 0): Promise<string> {
    return await scraperQueue.addTask(options, priority)
  }

  /**
   * Get scraper health metrics
   */
  async getHealthMetrics(): Promise<HealthMetrics> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const [successCount, failedCount, rateLimitedCount] = await Promise.all([
        prisma.scrape_operations.count({
          where: {
            status: 'success',
            started_at: { gte: oneDayAgo },
          },
        }),
        prisma.scrape_operations.count({
          where: {
            status: 'failed',
            started_at: { gte: oneDayAgo },
          },
        }),
        prisma.scrape_operations.count({
          where: {
            status: 'rate_limited',
            started_at: { gte: oneDayAgo },
          },
        }),
      ])

      const totalOperations = successCount + failedCount + rateLimitedCount
      const successRate = totalOperations > 0 ? (successCount / totalOperations) * 100 : 0

      return {
        last24Hours: {
          success: successCount,
          failed: failedCount,
          rateLimited: rateLimitedCount,
          total: totalOperations,
          successRate: Math.round(successRate * 100) / 100,
        },
        queue: scraperQueue.getStatus(),
        browser: {
          initialized: browserManager.isInitialized(),
        },
      }
    } catch (error) {
      console.error('[Scraper Service] Error getting health metrics:', error)
      return {
        error: 'Failed to get health metrics',
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await browserManager.close()
    scraperQueue.clearQueue()
  }
}

// Export singleton instance
export const scraperService = new ScraperService()
