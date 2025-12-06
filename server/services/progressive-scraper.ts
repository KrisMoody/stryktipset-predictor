import { prisma } from '~/server/utils/prisma'
import { scheduleWindowService } from './schedule-window-service'
import { scraperService } from './scraper/scraper-service'

/**
 * Progressive scraper service that queues matches for scraping based on data staleness.
 * Works with the schedule window service to refresh data more aggressively
 * as we approach spelstopp on Saturday.
 */
class ProgressiveScraper {
  private isRunning = false

  /**
   * Queue matches from current draws that have stale data
   * @param thresholdHours - Data older than this threshold will be refreshed
   * @returns Number of matches queued for scraping
   */
  async queueStaleMatches(thresholdHours: number): Promise<{ queued: number, skipped: number }> {
    if (this.isRunning) {
      console.log('[Progressive Scraper] Already running, skipping...')
      return { queued: 0, skipped: 0 }
    }

    this.isRunning = true
    const status = scheduleWindowService.getWindowStatus()

    console.log(`[Progressive Scraper] Starting stale match scan (threshold: ${thresholdHours}h, phase: ${status.currentPhase})`)

    try {
      const thresholdTime = new Date(Date.now() - thresholdHours * 60 * 60 * 1000)

      // Get all matches from current open draws
      const currentDraws = await prisma.draws.findMany({
        where: {
          status: 'Open',
        },
        include: {
          matches: {
            include: {
              match_scraped_data: {
                where: {
                  data_type: { in: ['xStats', 'statistics', 'headToHead'] },
                },
                orderBy: {
                  scraped_at: 'desc',
                },
              },
            },
          },
        },
      })

      let queued = 0
      let skipped = 0
      const dataTypes = ['xStats', 'statistics', 'headToHead']

      for (const draw of currentDraws) {
        console.log(`[Progressive Scraper] Checking draw #${draw.draw_number} (${draw.matches.length} matches)`)

        for (const match of draw.matches) {
          // Check which data types need refreshing
          const staleDataTypes: string[] = []

          for (const dataType of dataTypes) {
            const latestScrape = match.match_scraped_data.find(d => d.data_type === dataType)

            if (!latestScrape || latestScrape.scraped_at < thresholdTime) {
              staleDataTypes.push(dataType)
            }
          }

          if (staleDataTypes.length > 0) {
            console.log(`[Progressive Scraper] Match ${match.match_number} (ID: ${match.id}) has stale data: ${staleDataTypes.join(', ')}`)

            // Queue the match for scraping
            try {
              await scraperService.scrapeMatch({
                matchId: match.id,
                drawNumber: draw.draw_number,
                matchNumber: match.match_number,
                dataTypes: staleDataTypes,
              })
              queued++
            }
            catch (error) {
              console.error(`[Progressive Scraper] Error queueing match ${match.id}:`, error)
            }
          }
          else {
            skipped++
          }
        }
      }

      console.log(`[Progressive Scraper] Scan complete: ${queued} matches queued, ${skipped} skipped (data fresh)`)
      return { queued, skipped }
    }
    catch (error) {
      console.error('[Progressive Scraper] Error in stale match scan:', error)
      return { queued: 0, skipped: 0 }
    }
    finally {
      this.isRunning = false
    }
  }

  /**
   * Queue all matches from current draws for fresh data
   * Useful for final refresh before spelstopp
   * @returns Number of matches queued
   */
  async queueAllCurrentMatches(): Promise<{ queued: number }> {
    if (this.isRunning) {
      console.log('[Progressive Scraper] Already running, skipping...')
      return { queued: 0 }
    }

    this.isRunning = true
    console.log('[Progressive Scraper] Starting full refresh of all current matches')

    try {
      const currentDraws = await prisma.draws.findMany({
        where: {
          status: 'Open',
        },
        include: {
          matches: true,
        },
      })

      let queued = 0
      const dataTypes = ['xStats', 'statistics', 'headToHead']

      for (const draw of currentDraws) {
        console.log(`[Progressive Scraper] Queueing all matches from draw #${draw.draw_number}`)

        for (const match of draw.matches) {
          try {
            await scraperService.scrapeMatch({
              matchId: match.id,
              drawNumber: draw.draw_number,
              matchNumber: match.match_number,
              dataTypes,
            })
            queued++
          }
          catch (error) {
            console.error(`[Progressive Scraper] Error queueing match ${match.id}:`, error)
          }
        }
      }

      console.log(`[Progressive Scraper] Full refresh queued: ${queued} matches`)
      return { queued }
    }
    catch (error) {
      console.error('[Progressive Scraper] Error in full refresh:', error)
      return { queued: 0 }
    }
    finally {
      this.isRunning = false
    }
  }

  /**
   * Get current status of the progressive scraper
   */
  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning }
  }
}

// Export singleton instance
export const progressiveScraper = new ProgressiveScraper()
