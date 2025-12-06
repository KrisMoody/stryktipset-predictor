import { prisma } from '~/server/utils/prisma'
import { scheduleWindowService } from '~/server/services/schedule-window-service'
import type { ScrapeOptions } from '~/types'

interface QueuedTask {
  id: string
  options: ScrapeOptions
  priority: number
  createdAt: Date
  attempts: number
}

/**
 * Manages scraping queue with rate limiting
 * Delays and thresholds are dynamic based on the schedule window phase
 */
export class ScraperQueue {
  private queue: QueuedTask[] = []
  private processing = false
  private lastScrapeTime = 0

  /**
   * Add a scraping task to the queue
   */
  async addTask(options: ScrapeOptions, priority: number = 0): Promise<string> {
    const taskId = `${options.matchId}-${Date.now()}`

    // Check if we already scraped this match recently (threshold is dynamic)
    const recentScrape = await this.checkRecentScrape(options.matchId, options.dataTypes)
    if (recentScrape) {
      return taskId
    }

    const task: QueuedTask = {
      id: taskId,
      options,
      priority,
      createdAt: new Date(),
      attempts: 0,
    }

    this.queue.push(task)
    this.queue.sort((a, b) => b.priority - a.priority)

    console.log(`[Scraper Queue] Added task ${taskId} to queue (${this.queue.length} tasks total)`)

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue()
    }

    return taskId
  }

  /**
   * Get dynamic delay range based on scraping intensity
   * - very_aggressive (Saturday morning): 2-4s
   * - aggressive (Friday): 3-6s
   * - normal (Tue-Thu): 5-10s
   */
  private getDelayForIntensity(): { min: number, max: number } {
    const status = scheduleWindowService.getWindowStatus()
    switch (status.scrapingIntensity) {
      case 'very_aggressive':
        return { min: 2000, max: 4000 }
      case 'aggressive':
        return { min: 3000, max: 6000 }
      default:
        return { min: 5000, max: 10000 }
    }
  }

  /**
   * Check if match was scraped recently
   * Threshold is dynamic based on schedule window phase:
   * - Early (Tue-Thu): 24 hours
   * - Mid (Friday): 12 hours
   * - Late (Saturday): 4 hours
   */
  private async checkRecentScrape(matchId: number, dataTypes: string[]): Promise<boolean> {
    try {
      const status = scheduleWindowService.getWindowStatus()
      const thresholdHours = status.dataRefreshThreshold
      const thresholdTime = new Date(Date.now() - thresholdHours * 60 * 60 * 1000)

      const recentData = await prisma.match_scraped_data.findMany({
        where: {
          match_id: matchId,
          data_type: { in: dataTypes },
          scraped_at: { gte: thresholdTime },
        },
      })

      const isFresh = recentData.length === dataTypes.length
      if (isFresh) {
        console.log(`[Scraper Queue] Data for match ${matchId} is fresh (< ${thresholdHours}h old, phase: ${status.currentPhase})`)
      }

      return isFresh
    }
    catch (error) {
      console.error('[Scraper Queue] Error checking recent scrape:', error)
      return false
    }
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true
    const status = scheduleWindowService.getWindowStatus()
    console.log(`[Scraper Queue] Starting queue processing (${this.queue.length} tasks, intensity: ${status.scrapingIntensity})`)

    while (this.queue.length > 0) {
      const task = this.queue.shift()!

      // Rate limiting with dynamic delays based on intensity
      const now = Date.now()
      const timeSinceLastScrape = now - this.lastScrapeTime
      const { min: minDelay, max: maxDelay } = this.getDelayForIntensity()
      const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay

      if (timeSinceLastScrape < randomDelay) {
        const waitTime = randomDelay - timeSinceLastScrape
        console.log(`[Scraper Queue] Rate limiting: waiting ${Math.floor(waitTime / 1000)}s before next scrape`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }

      // Process task
      try {
        console.log(`[Scraper Queue] Processing task ${task.id} (attempt ${task.attempts + 1})`)
        // Note: Actual scraping will be implemented by the scraper service
        // This is just the queue management
        this.lastScrapeTime = Date.now()
      }
      catch (error) {
        console.error(`[Scraper Queue] Error processing task ${task.id}:`, error)

        // Retry logic
        task.attempts++
        if (task.attempts < 3) {
          // Exponential backoff
          const backoffDelay = task.attempts * 30000 // 30s, 60s, 90s
          console.log(`[Scraper Queue] Will retry task ${task.id} after ${backoffDelay / 1000}s`)

          setTimeout(() => {
            this.queue.push(task)
            this.queue.sort((a, b) => b.priority - a.priority)
          }, backoffDelay)
        }
        else {
          console.error(`[Scraper Queue] Task ${task.id} failed after 3 attempts`)

          // Log failure to database
          await this.logScrapeFailure(task.options, error as Error)
        }
      }
    }

    this.processing = false
    console.log('[Scraper Queue] Queue processing complete')
  }

  /**
   * Log scraping failure
   */
  private async logScrapeFailure(options: ScrapeOptions, error: Error): Promise<void> {
    try {
      for (const dataType of options.dataTypes) {
        await prisma.scrape_operations.create({
          data: {
            match_id: options.matchId,
            operation_type: dataType,
            status: 'failed',
            error_message: error.message,
            retry_count: 3,
            completed_at: new Date(),
          },
        })
      }
    }
    catch (dbError) {
      console.error('[Scraper Queue] Error logging scrape failure:', dbError)
    }
  }

  /**
   * Get queue status
   */
  getStatus(): { queueLength: number, processing: boolean, lastScrapeTime: Date | null } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      lastScrapeTime: this.lastScrapeTime > 0 ? new Date(this.lastScrapeTime) : null,
    }
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue = []
    console.log('[Scraper Queue] Queue cleared')
  }
}

// Export singleton instance
export const scraperQueue = new ScraperQueue()
