import { drawSyncService } from '~/server/services/draw-sync'
import { drawCacheService } from '~/server/services/draw-cache-service'
import { scheduleWindowService } from '~/server/services/schedule-window-service'
import { requireAdmin } from '~/server/utils/require-admin'
import { isValidGameType, DEFAULT_GAME_TYPE } from '~/types/game-types'
import type { GameType } from '~/types/game-types'

export default defineEventHandler(async event => {
  // Require admin access
  await requireAdmin(event)

  try {
    // Get optional gameType query parameter
    const query = getQuery(event)
    const gameTypeParam = query.gameType as string | undefined
    const gameType: GameType =
      gameTypeParam && isValidGameType(gameTypeParam) ? gameTypeParam : DEFAULT_GAME_TYPE

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

    // Perform sync for the specified game type
    console.log(`[Admin Sync] Syncing ${gameType} draws...`)
    const result = await drawSyncService.syncCurrentDraws(gameType)

    // Invalidate caches after successful sync
    if (result.success) {
      drawCacheService.invalidateCurrentDrawsCache(gameType)
      await scheduleWindowService.forceRefreshCache()
      console.log(`[Admin Sync] Caches invalidated for ${gameType} after manual sync`)
    }

    return {
      success: result.success,
      gameType,
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
