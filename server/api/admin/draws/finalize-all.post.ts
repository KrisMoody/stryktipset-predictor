import { requireAdmin } from '~/server/utils/require-admin'
import { drawLifecycle } from '~/server/services/draw-lifecycle'
import { drawCacheService } from '~/server/services/draw-cache-service'
import { scheduleWindowService } from '~/server/services/schedule-window-service'

export default defineEventHandler(async event => {
  await requireAdmin(event)

  try {
    console.log('[Admin] Running bulk draw finalization...')

    const result = await drawLifecycle.checkAndArchiveCompletedDraws()

    // Invalidate cache after successful finalization
    if (result.archived > 0) {
      drawCacheService.invalidateAllDrawCache()
      await scheduleWindowService.forceRefreshCache()
      console.log(`[Admin] Cache invalidated after finalizing ${result.archived} draws`)
    }

    return {
      success: true,
      ...result,
      message: `Finalization complete: ${result.archived} draws archived`,
    }
  } catch (error) {
    console.error('[Admin] Error in bulk finalization:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to finalize draws',
    })
  }
})
