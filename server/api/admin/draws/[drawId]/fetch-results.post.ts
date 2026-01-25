import { requireAdmin } from '~/server/utils/require-admin'
import { resultFallbackService } from '~/server/services/api-football/result-fallback-service'

/**
 * POST /api/admin/draws/[drawId]/fetch-results
 *
 * Fetches results from API-Football for matches missing results.
 * This is a dry-run that returns what would be updated without committing.
 * Use commit-results to actually save the results.
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
    console.log(`[Admin] Fetching results from API-Football for draw ${drawId}`)

    // Get status first to check if draw exists
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
        results: [],
        hasDiscrepancies: false,
      }
    }

    // Fetch results (dry run - doesn't commit)
    const results = await resultFallbackService.previewDrawResults(drawId)

    // Check for discrepancies
    const discrepancies = results.filter(r => r.hasDiscrepancy)
    const fetchedResults = results.filter(r => r.fetchedResult?.isFinished)
    const terminalStatuses = results.filter(r => r.fetchedResult?.isTerminal)
    const inProgress = results.filter(
      r => r.fetchedResult && !r.fetchedResult.isFinished && !r.fetchedResult.isTerminal
    )
    const errors = results.filter(r => r.error)

    return {
      success: true,
      drawNumber: status.drawNumber,
      gameType: status.gameType,
      results,
      summary: {
        total: results.length,
        readyToCommit: fetchedResults.length,
        terminalStatuses: terminalStatuses.length,
        inProgress: inProgress.length,
        errors: errors.length,
        discrepancies: discrepancies.length,
      },
      hasDiscrepancies: discrepancies.length > 0,
      discrepancyDetails: discrepancies.map(d => ({
        matchId: d.matchId,
        matchNumber: d.matchNumber,
        homeTeam: d.homeTeam,
        awayTeam: d.awayTeam,
        svenskaSpel: d.existingResult ? `${d.existingResult.home}-${d.existingResult.away}` : 'N/A',
        apiFootball: d.fetchedResult
          ? `${d.fetchedResult.homeGoals}-${d.fetchedResult.awayGoals}`
          : 'N/A',
      })),
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error(`[Admin] Error fetching results for draw ${drawId}:`, error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to fetch results',
    })
  }
})
