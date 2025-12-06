import { drawSyncService } from '~/server/services/draw-sync'
import { drawCacheService } from '~/server/services/draw-cache-service'
import { scheduleWindowService } from '~/server/services/schedule-window-service'

export default defineEventHandler(async event => {
  try {
    // Read body for adminOverride flag
    const body = await readBody(event).catch(() => ({}))
    const adminOverride = body?.adminOverride === true

    // Check schedule window
    const status = scheduleWindowService.getWindowStatus()
    const permission = scheduleWindowService.shouldAllowOperation('sync', adminOverride)

    if (!permission.allowed) {
      return {
        success: false,
        error: permission.reason,
        windowStatus: {
          isActive: status.isActive,
          reason: status.reason,
        },
      }
    }

    // Perform sync
    const result = await drawSyncService.syncCurrentDraws()

    // Invalidate cache after successful sync
    if (result.success) {
      drawCacheService.invalidateAllDrawCache()
      console.log('[Admin Sync] Cache invalidated after manual sync')
    }

    return {
      success: result.success,
      drawsProcessed: result.drawsProcessed,
      matchesProcessed: result.matchesProcessed,
      cacheInvalidated: result.success,
      syncType: 'full',
      windowStatus: {
        isActive: status.isActive,
        phase: status.currentPhase,
      },
      error: result.error,
    }
  } catch (error) {
    console.error('Error syncing draws:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
