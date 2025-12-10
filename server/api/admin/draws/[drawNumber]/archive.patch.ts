import { drawLifecycle } from '~/server/services/draw-lifecycle'
import { drawCacheService } from '~/server/services/draw-cache-service'
import { requireAdmin } from '~/server/utils/require-admin'

export default defineEventHandler(async event => {
  // Require admin access
  await requireAdmin(event)

  const drawNumber = Number(getRouterParam(event, 'drawNumber'))

  if (isNaN(drawNumber) || drawNumber <= 0) {
    throw createError({
      statusCode: 400,
      message: 'Invalid draw number',
    })
  }

  try {
    const body = await readBody(event).catch(() => ({}))
    const force = body?.force === true
    const gameType = body?.gameType || 'stryktipset'

    const result = await drawLifecycle.manualArchiveDraw(drawNumber, force, gameType)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      }
    }

    // Invalidate cache after successful archive
    drawCacheService.invalidateAllDrawCache()
    console.log(`[Admin] Cache invalidated after archiving draw ${drawNumber}`)

    return {
      success: true,
      drawNumber,
      wasForced: result.wasForced,
      message: `Draw ${drawNumber} archived successfully`,
    }
  } catch (error) {
    console.error(`[Admin] Error archiving draw ${drawNumber}:`, error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to archive draw',
    })
  }
})
