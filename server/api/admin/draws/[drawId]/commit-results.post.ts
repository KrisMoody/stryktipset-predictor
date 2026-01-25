import { requireAdmin } from '~/server/utils/require-admin'
import { resultFallbackService } from '~/server/services/api-football/result-fallback-service'
import { drawCacheService } from '~/server/services/draw-cache-service'
import { scheduleWindowService } from '~/server/services/schedule-window-service'

/**
 * POST /api/admin/draws/[drawId]/commit-results
 *
 * Commits fetched API-Football results to the database.
 * Updates match results and archives the draw if it becomes complete.
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
    const body = await readBody(event).catch(() => ({}))
    const force = body?.force === true // Force commit even if discrepancies exist

    console.log(`[Admin] Committing API-Football results for draw ${drawId}`)

    // Get status first
    const status = await resultFallbackService.getDrawResultStatus(drawId)

    if (!status) {
      throw createError({
        statusCode: 404,
        message: 'Draw not found',
      })
    }

    if (status.matchesMissingResults === 0) {
      return {
        success: true,
        message: 'All matches already have results',
        resultsUpdated: 0,
        drawArchived: false,
      }
    }

    // If not forcing, check for discrepancies first
    if (!force) {
      const previewResults = await resultFallbackService.previewDrawResults(drawId)
      const discrepancies = previewResults.filter(r => r.hasDiscrepancy)

      if (discrepancies.length > 0) {
        return {
          success: false,
          error: 'Discrepancies found between Svenska Spel and API-Football results',
          discrepancies: discrepancies.map(d => ({
            matchId: d.matchId,
            matchNumber: d.matchNumber,
            svenskaSpel: d.existingResult
              ? `${d.existingResult.home}-${d.existingResult.away}`
              : 'N/A',
            apiFootball: d.fetchedResult
              ? `${d.fetchedResult.homeGoals}-${d.fetchedResult.awayGoals}`
              : 'N/A',
          })),
          hint: 'Use force: true to commit results despite discrepancies',
        }
      }
    }

    // Sync results (commits to database)
    const syncResult = await resultFallbackService.syncDrawResults(drawId, true)

    // Invalidate cache if any changes were made
    if (syncResult.resultsUpdated > 0 || syncResult.statusesUpdated > 0) {
      drawCacheService.invalidateAllDrawCache()
      await scheduleWindowService.forceRefreshCache()
    }

    return {
      success: true,
      drawNumber: syncResult.drawNumber,
      resultsUpdated: syncResult.resultsUpdated,
      statusesUpdated: syncResult.statusesUpdated,
      skipped: syncResult.skipped,
      errors: syncResult.errors,
      drawArchived: syncResult.drawArchived,
      details: syncResult.details,
      message: syncResult.drawArchived
        ? `Updated ${syncResult.resultsUpdated} results and archived draw`
        : `Updated ${syncResult.resultsUpdated} results`,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error(`[Admin] Error committing results for draw ${drawId}:`, error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to commit results',
    })
  }
})
