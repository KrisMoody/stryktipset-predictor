import { prisma } from '~/server/utils/prisma'
import { scheduleWindowService } from './schedule-window-service'
import { scraperService } from './scraper/scraper-service'

/**
 * Progressive scraper service that queues matches for scraping based on data staleness.
 * Works with the schedule window service to refresh data more aggressively
 * as we approach each draw's spelstopp deadline.
 *
 * Supports per-draw threshold calculation for multi-game scenarios where
 * different draws (Stryktipset, Europatipset, Topptipset) may have different
 * deadlines and require different refresh intensities.
 */
class ProgressiveScraper {
  private isRunning = false

  /**
   * Queue matches from current draws that have stale data.
   * Uses per-draw threshold calculation when no explicit threshold is provided.
   *
   * @param defaultThresholdHours - Optional default threshold; if not provided, uses per-draw calculation
   * @returns Number of matches queued for scraping
   */
  async queueStaleMatches(
    defaultThresholdHours?: number
  ): Promise<{ queued: number; skipped: number }> {
    if (this.isRunning) {
      console.log('[Progressive Scraper] Already running, skipping...')
      return { queued: 0, skipped: 0 }
    }

    this.isRunning = true
    const globalStatus = scheduleWindowService.getWindowStatus()

    console.log(
      `[Progressive Scraper] Starting stale match scan (` +
        `default threshold: ${defaultThresholdHours ?? 'per-draw'}, ` +
        `active draws: ${globalStatus.activeDraws.length})`
    )

    try {
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
                  data_type: { in: ['xStats', 'statistics', 'headToHead', 'lineup', 'injuries'] },
                },
                orderBy: {
                  scraped_at: 'desc',
                },
                select: {
                  data_type: true,
                  scraped_at: true,
                  source: true,
                },
              },
            },
          },
        },
      })

      let queued = 0
      let skipped = 0
      const dataTypes: ('xStats' | 'statistics' | 'headToHead' | 'news' | 'lineup')[] = [
        'xStats',
        'statistics',
        'headToHead',
        'lineup',
      ]

      for (const draw of currentDraws) {
        // Calculate per-draw threshold based on its individual deadline
        let thresholdHours = defaultThresholdHours

        if (thresholdHours === undefined && draw.close_time) {
          // Get this draw's specific schedule status
          const drawStatus = scheduleWindowService.getDrawScheduleStatus({
            gameType: draw.game_type,
            drawNumber: draw.draw_number,
            closeTime: draw.close_time,
          })
          thresholdHours = drawStatus.dataRefreshThreshold

          console.log(
            `[Progressive Scraper] Draw ${draw.game_type}#${draw.draw_number}: ` +
              `${drawStatus.hoursUntilClose.toFixed(1)}h to close, ` +
              `phase=${drawStatus.phase}, threshold=${thresholdHours}h`
          )
        } else if (thresholdHours === undefined) {
          // Fallback if no close_time (shouldn't happen for open draws)
          thresholdHours = 24
          console.log(
            `[Progressive Scraper] Draw ${draw.game_type}#${draw.draw_number}: ` +
              `no close_time, using default threshold=${thresholdHours}h`
          )
        } else {
          console.log(
            `[Progressive Scraper] Draw ${draw.game_type}#${draw.draw_number}: ` +
              `using provided threshold=${thresholdHours}h (${draw.matches.length} matches)`
          )
        }

        const thresholdTime = new Date(Date.now() - thresholdHours * 60 * 60 * 1000)
        // API-Football data has a longer freshness period (24h)
        const apiFootballThresholdTime = new Date(Date.now() - 24 * 60 * 60 * 1000)

        // Get runtime config for skipScrapingWhenAvailable setting
        const runtimeConfig = useRuntimeConfig()
        const apiFootballConfig = runtimeConfig.apiFootball as {
          skipScrapingWhenAvailable?: boolean
        }
        const skipWhenApiAvailable = apiFootballConfig?.skipScrapingWhenAvailable ?? false

        for (const match of draw.matches) {
          // Check which data types need refreshing
          const staleDataTypes: ('xStats' | 'statistics' | 'headToHead' | 'news' | 'lineup')[] = []

          for (const dataType of dataTypes) {
            const latestScrape = match.match_scraped_data.find(d => d.data_type === dataType)

            // Skip scraping if API-Football data is fresh and skipWhenApiAvailable is enabled
            if (skipWhenApiAvailable && latestScrape?.source === 'api-football') {
              // API-Football data uses longer threshold (24h)
              if (latestScrape.scraped_at >= apiFootballThresholdTime) {
                console.log(
                  `[Progressive Scraper] Skipping ${dataType} for match ${match.id} - API-Football data is fresh`
                )
                continue // Data is fresh, skip this type
              }
            }

            if (!latestScrape || latestScrape.scraped_at < thresholdTime) {
              staleDataTypes.push(dataType)
            }
          }

          if (staleDataTypes.length > 0) {
            console.log(
              `[Progressive Scraper] Match ${match.match_number} (ID: ${match.id}) has stale data: ${staleDataTypes.join(', ')}`
            )

            // Queue the match for scraping
            try {
              await scraperService.scrapeMatch({
                matchId: match.id,
                drawNumber: draw.draw_number,
                matchNumber: match.match_number,
                dataTypes: staleDataTypes,
              })
              queued++
            } catch (error) {
              console.error(`[Progressive Scraper] Error queueing match ${match.id}:`, error)
            }
          } else {
            skipped++
          }
        }
      }

      console.log(
        `[Progressive Scraper] Scan complete: ${queued} matches queued, ${skipped} skipped (data fresh)`
      )
      return { queued, skipped }
    } catch (error) {
      console.error('[Progressive Scraper] Error in stale match scan:', error)
      return { queued: 0, skipped: 0 }
    } finally {
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
      const dataTypes: ('xStats' | 'statistics' | 'headToHead' | 'news' | 'lineup')[] = [
        'xStats',
        'statistics',
        'headToHead',
        'lineup',
      ]

      for (const draw of currentDraws) {
        console.log(
          `[Progressive Scraper] Queueing all matches from ${draw.game_type}#${draw.draw_number}`
        )

        for (const match of draw.matches) {
          try {
            await scraperService.scrapeMatch({
              matchId: match.id,
              drawNumber: draw.draw_number,
              matchNumber: match.match_number,
              dataTypes,
            })
            queued++
          } catch (error) {
            console.error(`[Progressive Scraper] Error queueing match ${match.id}:`, error)
          }
        }
      }

      console.log(`[Progressive Scraper] Full refresh queued: ${queued} matches`)
      return { queued }
    } catch (error) {
      console.error('[Progressive Scraper] Error in full refresh:', error)
      return { queued: 0 }
    } finally {
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
