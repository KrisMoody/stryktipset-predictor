import { cacheService } from '~/server/services/cache-service'
import { drawCacheService } from '~/server/services/draw-cache-service'
import { requireAdmin } from '~/server/utils/require-admin'

export default defineEventHandler(async event => {
  await requireAdmin(event)

  try {
    // Get stats before clearing
    const statsBefore = cacheService.getStats()

    // Clear both caches
    cacheService.flush()
    drawCacheService.invalidateAllDrawCache()

    // Get stats after clearing
    const statsAfter = cacheService.getStats()

    return {
      success: true,
      cleared: {
        keysBefore: statsBefore.keys,
        keysAfter: statsAfter.keys,
        keysCleared: statsBefore.keys - statsAfter.keys,
      },
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error clearing cache:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
