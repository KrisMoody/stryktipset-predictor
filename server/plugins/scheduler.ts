import { Cron } from 'croner'
import { drawSyncService } from '../services/draw-sync'
import { performanceTracker } from '../services/performance-tracker'
import { drawCacheService } from '../services/draw-cache-service'
import { scheduleWindowService } from '../services/schedule-window-service'
import { progressiveScraper } from '../services/progressive-scraper'
import { captureOperationError } from '../utils/bugsnag-helpers'

export default defineNitroPlugin(() => {
  // Skip scheduler in CI/test environments to prevent blocking server startup
  if (process.env.CI || process.env.NODE_ENV === 'test') {
    console.log('[Scheduler] Skipping scheduled tasks in CI/test environment')
    return
  }

  console.log('[Scheduler] Initializing scheduled tasks...')

  // Sync current draws daily at midnight - window-aware
  new Cron('0 0 * * *', async () => {
    const status = scheduleWindowService.getWindowStatus()
    console.log(
      `[Scheduler] Running scheduled draw sync (window: ${status.isActive ? 'active' : 'closed'}, phase: ${status.currentPhase})`
    )

    try {
      if (status.isActive) {
        // Full sync during active window
        const result = await drawSyncService.syncCurrentDraws()
        if (result.success) {
          console.log(
            `[Scheduler] Full sync completed: ${result.drawsProcessed} draws, ${result.matchesProcessed} matches`
          )
          drawCacheService.invalidateAllDrawCache()
        } else {
          console.error(`[Scheduler] Full sync failed: ${result.error}`)
        }
      } else {
        // Metadata-only sync outside window
        const result = await drawSyncService.syncDrawMetadataOnly()
        if (result.success) {
          console.log(`[Scheduler] Metadata sync completed: ${result.drawsProcessed} draws`)
          drawCacheService.invalidateAllDrawCache()
        } else {
          console.error(`[Scheduler] Metadata sync failed: ${result.error}`)
        }
      }
    } catch (error) {
      console.error('[Scheduler] Unexpected error in scheduled draw sync:', error)

      captureOperationError(error, {
        operation: 'scheduled_task',
        service: 'draw-sync',
        metadata: { schedule: 'daily-midnight', windowActive: status.isActive },
      })
    }
  })

  // Sunday 6 AM - light sync to detect new coupon opening
  new Cron('0 6 * * 0', async () => {
    console.log('[Scheduler] Running Sunday morning metadata sync to detect new coupon...')
    try {
      const result = await drawSyncService.syncDrawMetadataOnly()
      if (result.success) {
        console.log(`[Scheduler] Sunday metadata sync completed: ${result.drawsProcessed} draws`)
        drawCacheService.invalidateAllDrawCache()
      } else {
        console.error(`[Scheduler] Sunday metadata sync failed: ${result.error}`)
      }
    } catch (error) {
      console.error('[Scheduler] Unexpected error in Sunday metadata sync:', error)

      captureOperationError(error, {
        operation: 'scheduled_task',
        service: 'draw-sync',
        metadata: { schedule: 'sunday-6am' },
      })
    }
  })

  // Update prediction performance daily at 3 AM
  new Cron('0 3 * * *', async () => {
    console.log('[Scheduler] Running scheduled performance update...')
    try {
      await performanceTracker.updatePerformance()
      console.log('[Scheduler] Performance update completed successfully')
    } catch (error) {
      console.error('[Scheduler] Error in scheduled performance update:', error)

      captureOperationError(error, {
        operation: 'scheduled_task',
        service: 'performance-tracker',
        metadata: { schedule: 'daily-3am' },
      })
    }
  })

  // Progressive scraping: Every 4 hours Tue-Fri (during active window)
  // Refreshes stale match data based on dynamic threshold
  new Cron('0 8,12,16,20 * * 2-5', async () => {
    const status = scheduleWindowService.getWindowStatus()
    if (!status.isActive) {
      console.log('[Scheduler] Skipping progressive scrape - outside betting window')
      return
    }

    console.log(
      `[Scheduler] Running progressive scrape (phase: ${status.currentPhase}, threshold: ${status.dataRefreshThreshold}h)`
    )
    try {
      const result = await progressiveScraper.queueStaleMatches(status.dataRefreshThreshold)
      console.log(
        `[Scheduler] Progressive scrape complete: ${result.queued} queued, ${result.skipped} skipped`
      )
    } catch (error) {
      console.error('[Scheduler] Error in progressive scrape:', error)

      captureOperationError(error, {
        operation: 'scheduled_task',
        service: 'progressive-scraper',
        metadata: { schedule: 'tue-fri-4h', phase: status.currentPhase },
      })
    }
  })

  // Saturday aggressive scraping: Every 2 hours from 6 AM to 2 PM (before 15:59 spelstopp)
  // Uses shorter threshold (4h) for fresher data on match day
  new Cron('0 6,8,10,12,14 * * 6', async () => {
    const status = scheduleWindowService.getWindowStatus()
    if (!status.isActive) {
      console.log('[Scheduler] Skipping Saturday scrape - outside betting window')
      return
    }

    console.log(
      `[Scheduler] Running Saturday aggressive scrape (phase: ${status.currentPhase}, threshold: ${status.dataRefreshThreshold}h)`
    )
    try {
      const result = await progressiveScraper.queueStaleMatches(status.dataRefreshThreshold)
      console.log(
        `[Scheduler] Saturday scrape complete: ${result.queued} queued, ${result.skipped} skipped`
      )
    } catch (error) {
      console.error('[Scheduler] Error in Saturday scrape:', error)

      captureOperationError(error, {
        operation: 'scheduled_task',
        service: 'progressive-scraper',
        metadata: { schedule: 'saturday-2h', phase: status.currentPhase },
      })
    }
  })

  // Initial sync on startup (after 30 seconds to allow server warmup)
  const runInitialSync = async (attempt = 1, maxAttempts = 3) => {
    console.log(`[Scheduler] Running initial draw sync (attempt ${attempt}/${maxAttempts})...`)
    try {
      const result = await drawSyncService.syncCurrentDraws()
      if (result.success) {
        console.log(
          `[Scheduler] Initial sync completed: ${result.drawsProcessed} draws, ${result.matchesProcessed} matches`
        )
      } else {
        console.warn(`[Scheduler] Initial sync had issues: ${result.error}`)

        // Retry if we haven't reached max attempts and got no draws
        if (attempt < maxAttempts && result.drawsProcessed === 0) {
          const retryDelay = attempt * 15000 // 15s, 30s
          console.log(`[Scheduler] Retrying initial sync in ${retryDelay / 1000} seconds...`)
          setTimeout(() => runInitialSync(attempt + 1, maxAttempts), retryDelay)
        }
      }
    } catch (error) {
      console.error(`[Scheduler] Error in initial sync (attempt ${attempt}):`, error)

      // Retry if we haven't reached max attempts
      if (attempt < maxAttempts) {
        const retryDelay = attempt * 15000 // 15s, 30s
        console.log(`[Scheduler] Retrying initial sync in ${retryDelay / 1000} seconds...`)
        setTimeout(() => runInitialSync(attempt + 1, maxAttempts), retryDelay)
      } else {
        console.error(
          '[Scheduler] Initial sync failed after all retry attempts. Scheduled syncs will continue.'
        )
      }
    }
  }

  setTimeout(() => runInitialSync(), 30000) // Start after 30 seconds

  console.log('[Scheduler] Scheduled tasks initialized:')
  console.log(
    '  - Draw sync: Daily at midnight (window-aware: full sync if active, metadata-only if closed)'
  )
  console.log('  - Sunday sync: 6 AM (metadata-only to detect new coupon)')
  console.log('  - Performance update: Daily at 3 AM')
  console.log('  - Progressive scrape: Tue-Fri at 8:00, 12:00, 16:00, 20:00 (stale data refresh)')
  console.log(
    '  - Saturday scrape: 6:00, 8:00, 10:00, 12:00, 14:00 (aggressive refresh before spelstopp)'
  )
  console.log('  - Initial sync: 30 seconds after startup (with retry logic)')
})
