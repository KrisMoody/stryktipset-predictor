import { Cron } from 'croner'
import { drawSyncService } from '../services/draw-sync'
import { performanceTracker } from '../services/performance-tracker'
import { drawCacheService } from '../services/draw-cache-service'
import { scheduleWindowService } from '../services/schedule-window-service'
import { progressiveScraper } from '../services/progressive-scraper'
import { drawLifecycle } from '../services/draw-lifecycle'
import { embeddingsService } from '../services/embeddings-service'
import { resultFallbackService } from '../services/api-football/result-fallback-service'
import { captureOperationError } from '../utils/bugsnag-helpers'
import { getAllGameTypes } from '../constants/game-configs'
import { prisma } from '../utils/prisma'

export default defineNitroPlugin(() => {
  // Skip scheduler in CI/test environments to prevent blocking server startup
  if (process.env.CI || process.env.NODE_ENV === 'test') {
    console.log('[Scheduler] Skipping scheduled tasks in CI/test environment')
    return
  }

  console.log('[Scheduler] Initializing multi-game scheduled tasks...')

  /**
   * Sync all game types
   */
  const syncAllGameTypes = async (
    mode: 'full' | 'metadata'
  ): Promise<{ total: number; errors: string[] }> => {
    const gameTypes = getAllGameTypes()
    let total = 0
    const errors: string[] = []

    for (const gameType of gameTypes) {
      try {
        const result =
          mode === 'full'
            ? await drawSyncService.syncCurrentDraws(gameType)
            : await drawSyncService.syncDrawMetadataOnly(gameType)

        if (result.success) {
          total += result.drawsProcessed
          const matchInfo =
            mode === 'full' && 'matchesProcessed' in result
              ? `, ${result.matchesProcessed} matches`
              : ''
          console.log(`[Scheduler] Synced ${gameType}: ${result.drawsProcessed} draws${matchInfo}`)
        } else {
          errors.push(`${gameType}: ${result.error}`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(`${gameType}: ${errorMsg}`)
        console.error(`[Scheduler] Error syncing ${gameType}:`, error)
      }
    }

    return { total, errors }
  }

  /**
   * Generate embeddings for recently synced matches (background, fire-and-forget)
   */
  const generateEmbeddingsForRecentMatches = async () => {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
      const recentMatches = await prisma.matches.findMany({
        where: {
          updated_at: { gte: tenMinutesAgo },
          outcome: null, // Only upcoming matches (not completed)
        },
        select: { id: true },
      })

      if (recentMatches.length > 0) {
        console.log(
          `[Scheduler] Queueing ${recentMatches.length} recently synced matches for embedding generation`
        )
        // Run in background with rate limiting to avoid blocking
        embeddingsService
          .generateBatchEmbeddings(
            recentMatches.map(m => m.id),
            { skipExisting: true, delayMs: 1000 }
          )
          .then(result => {
            console.log(
              `[Scheduler] Embedding generation complete: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`
            )
          })
          .catch(error => {
            console.error('[Scheduler] Error generating embeddings:', error)
          })
      }
    } catch (error) {
      console.error('[Scheduler] Error querying matches for embeddings:', error)
    }
  }

  // Refresh schedule window cache every 5 minutes
  new Cron('*/5 * * * *', async () => {
    try {
      await scheduleWindowService.refreshActiveDrawsCache()
    } catch (error) {
      console.error('[Scheduler] Error refreshing schedule cache:', error)
    }
  })

  // Sync all game types daily at midnight
  new Cron('0 0 * * *', async () => {
    const status = await scheduleWindowService.getWindowStatusAsync()
    console.log(
      `[Scheduler] Running midnight sync for all games (window: ${status.isActive ? 'active' : 'closed'}, phase: ${status.currentPhase})`
    )

    try {
      const mode = status.isActive ? 'full' : 'metadata'
      const { total, errors } = await syncAllGameTypes(mode)

      if (errors.length === 0) {
        console.log(`[Scheduler] Midnight sync completed: ${total} draws total`)
      } else {
        console.warn(
          `[Scheduler] Midnight sync completed with errors: ${total} draws, ${errors.length} failures`
        )
      }

      drawCacheService.invalidateAllDrawCache()
      await scheduleWindowService.forceRefreshCache()

      // Generate embeddings for newly synced matches (background)
      generateEmbeddingsForRecentMatches()
    } catch (error) {
      console.error('[Scheduler] Unexpected error in midnight sync:', error)

      captureOperationError(error, {
        operation: 'scheduled_task',
        service: 'draw-sync',
        metadata: { schedule: 'daily-midnight', windowActive: status.isActive },
      })
    }
  })

  // Morning sync at 6 AM for all games (catches overnight draw openings)
  new Cron('0 6 * * *', async () => {
    console.log('[Scheduler] Running 6 AM sync for all games...')
    try {
      const { total, errors } = await syncAllGameTypes('full')

      if (errors.length === 0) {
        console.log(`[Scheduler] 6 AM sync completed: ${total} draws total`)
      } else {
        console.warn(
          `[Scheduler] 6 AM sync completed with errors: ${total} draws, ${errors.length} failures`
        )
      }

      drawCacheService.invalidateAllDrawCache()
      await scheduleWindowService.forceRefreshCache()

      // Generate embeddings for newly synced matches (background)
      generateEmbeddingsForRecentMatches()
    } catch (error) {
      console.error('[Scheduler] Unexpected error in 6 AM sync:', error)

      captureOperationError(error, {
        operation: 'scheduled_task',
        service: 'draw-sync',
        metadata: { schedule: 'daily-6am' },
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

  // Archive completed draws daily at 4 AM
  new Cron('0 4 * * *', async () => {
    console.log('[Scheduler] Running scheduled draw finalization check...')
    try {
      const result = await drawLifecycle.checkAndArchiveCompletedDraws()
      console.log(
        `[Scheduler] Draw finalization completed: ${result.checked} checked, ${result.archived} archived, ${result.errors} errors`
      )

      // Invalidate cache if any draws were archived
      if (result.archived > 0) {
        drawCacheService.invalidateAllDrawCache()
        await scheduleWindowService.forceRefreshCache()
      }
    } catch (error) {
      console.error('[Scheduler] Error in scheduled draw finalization:', error)

      captureOperationError(error, {
        operation: 'scheduled_task',
        service: 'draw-lifecycle',
        metadata: { schedule: 'daily-4am' },
      })
    }
  })

  // Result fallback sync: Every 6 hours (0:30, 6:30, 12:30, 18:30)
  // Fetches missing results from API-Football for draws 48h past last match start
  new Cron('30 0,6,12,18 * * *', async () => {
    console.log('[Scheduler] Running result fallback sync from API-Football...')
    try {
      const result = await resultFallbackService.runAutomaticSync()
      console.log(
        `[Scheduler] Result fallback sync completed: ${result.drawsProcessed} draws, ` +
          `${result.totalResultsUpdated} results updated, ${result.totalDrawsArchived} draws archived`
      )

      // Invalidate cache if any draws were archived
      if (result.totalDrawsArchived > 0) {
        drawCacheService.invalidateAllDrawCache()
        await scheduleWindowService.forceRefreshCache()
      }
    } catch (error) {
      console.error('[Scheduler] Error in result fallback sync:', error)

      captureOperationError(error, {
        operation: 'scheduled_task',
        service: 'result-fallback',
        metadata: { schedule: 'every-6h' },
      })
    }
  })

  // Dynamic scraping: Every hour, decide based on deadline proximity
  // - Late phase (< 12h): scrape every hour
  // - Mid phase (12-36h): scrape every 2 hours
  // - Early phase (> 36h): scrape every 4 hours
  // - Closed: skip
  new Cron('0 * * * *', async () => {
    const status = await scheduleWindowService.getWindowStatusAsync()

    if (!status.isActive) {
      // No active draws, skip scraping
      return
    }

    const hour = new Date().getHours()

    // Determine if we should scrape based on phase
    let shouldScrape = false
    switch (status.currentPhase) {
      case 'late':
        // Scrape every hour in late phase
        shouldScrape = true
        break
      case 'mid':
        // Scrape every 2 hours in mid phase
        shouldScrape = hour % 2 === 0
        break
      case 'early':
        // Scrape every 4 hours in early phase
        shouldScrape = hour % 4 === 0
        break
    }

    if (!shouldScrape) {
      return
    }

    console.log(
      `[Scheduler] Running dynamic scrape (phase: ${status.currentPhase}, ` +
        `threshold: ${status.dataRefreshThreshold}h, active draws: ${status.activeDraws.length})`
    )

    try {
      const result = await progressiveScraper.queueStaleMatches(status.dataRefreshThreshold)
      console.log(
        `[Scheduler] Dynamic scrape complete: ${result.queued} queued, ${result.skipped} skipped`
      )
    } catch (error) {
      console.error('[Scheduler] Error in dynamic scrape:', error)

      captureOperationError(error, {
        operation: 'scheduled_task',
        service: 'progressive-scraper',
        metadata: {
          schedule: 'hourly-dynamic',
          phase: status.currentPhase,
          activeDraws: status.activeDraws.length,
        },
      })
    }
  })

  // Initial sync on startup (after 30 seconds to allow server warmup)
  const runInitialSync = async (attempt = 1, maxAttempts = 3) => {
    console.log(
      `[Scheduler] Running initial sync for all games (attempt ${attempt}/${maxAttempts})...`
    )
    try {
      const { total, errors } = await syncAllGameTypes('full')

      if (total > 0 || errors.length === 0) {
        console.log(
          `[Scheduler] Initial sync completed: ${total} draws${
            errors.length > 0 ? ` (${errors.length} games had errors)` : ''
          }`
        )
        drawCacheService.invalidateAllDrawCache()
        await scheduleWindowService.forceRefreshCache()

        // Generate embeddings for newly synced matches (background)
        generateEmbeddingsForRecentMatches()
      } else if (attempt < maxAttempts) {
        // No draws synced and we have retries left
        const retryDelay = attempt * 15000 // 15s, 30s
        console.log(`[Scheduler] Retrying initial sync in ${retryDelay / 1000} seconds...`)
        setTimeout(() => runInitialSync(attempt + 1, maxAttempts), retryDelay)
      } else {
        console.error(
          '[Scheduler] Initial sync failed after all retry attempts. Scheduled syncs will continue.'
        )
      }
    } catch (error) {
      console.error(`[Scheduler] Error in initial sync (attempt ${attempt}):`, error)

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

  console.log('[Scheduler] Multi-game scheduled tasks initialized:')
  console.log('  - Cache refresh: Every 5 minutes')
  console.log('  - Draw sync: Daily at midnight and 6 AM (all game types)')
  console.log('  - Performance update: Daily at 3 AM')
  console.log('  - Draw finalization: Daily at 4 AM')
  console.log('  - Result fallback sync: Every 6 hours (API-Football for missing results)')
  console.log('  - Dynamic scrape: Hourly (frequency based on deadline proximity)')
  console.log('    - Late phase (<12h): every hour')
  console.log('    - Mid phase (12-36h): every 2 hours')
  console.log('    - Early phase (>36h): every 4 hours')
  console.log('  - Initial sync: 30 seconds after startup (with retry logic)')
})
