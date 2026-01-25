import { requireAdmin } from '~/server/utils/require-admin'
import { resultFallbackService } from '~/server/services/api-football/result-fallback-service'

/**
 * GET /api/admin/draws/[drawId]/result-status
 *
 * Returns detailed result status for a draw, showing which matches
 * are missing results and whether API-Football data is available.
 */
export default defineEventHandler(async event => {
  await requireAdmin(event)

  const drawIdParam = getRouterParam(event, 'drawId')
  const drawId = Number(drawIdParam)

  if (isNaN(drawId) || drawId <= 0) {
    throw createError({
      statusCode: 400,
      message: 'Invalid draw ID',
    })
  }

  try {
    const status = await resultFallbackService.getDrawResultStatus(drawId)

    if (!status) {
      throw createError({
        statusCode: 404,
        message: 'Draw not found',
      })
    }

    return {
      success: true,
      ...status,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error(`[Admin] Error fetching result status for draw ${drawId}:`, error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to fetch result status',
    })
  }
})
