import { requireAdmin } from '~/server/utils/require-admin'
import { failedGamesService } from '~/server/services/failed-games-service'
import { drawSyncService } from '~/server/services/draw-sync'
import { createApiClient } from '~/server/services/svenska-spel-api'
import { prisma } from '~/server/utils/prisma'
import { resultFallbackService } from '~/server/services/api-football/result-fallback-service'
import type { GameType } from '~/types/game-types'

export default defineEventHandler(async event => {
  await requireAdmin(event)

  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)

  if (isNaN(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      message: 'Invalid failed game ID',
    })
  }

  try {
    // Get the failed game record
    const failedGame = await failedGamesService.getFailedGameById(id)

    if (!failedGame) {
      // Record was deleted by a background sync - this is actually success
      return {
        success: true,
        alreadyResolved: true,
        message: 'This failed game was already processed by a background sync.',
      }
    }

    // Get the draw to find the draw number
    const draw = await prisma.draws.findUnique({
      where: { id: failedGame.drawId },
      select: { draw_number: true, game_type: true },
    })

    if (!draw) {
      return {
        success: false,
        error: 'Draw not found',
      }
    }

    // Check if match already exists (concurrent sync may have created it)
    const existingMatchEarly = await prisma.matches.findUnique({
      where: {
        draw_id_match_number: {
          draw_id: failedGame.drawId,
          match_number: failedGame.matchNumber,
        },
      },
    })

    if (existingMatchEarly) {
      // Match already exists - the concurrent sync already processed it
      await failedGamesService.markResolvedSafe(id, 'api_retry')
      return {
        success: true,
        alreadyResolved: true,
        message: `Match ${failedGame.matchNumber} was already processed.`,
        matchId: existingMatchEarly.id,
      }
    }

    // Update status to retry_scheduled (gracefully handle if deleted)
    const statusUpdated = await failedGamesService.updateStatusSafe(id, 'retry_scheduled')

    if (!statusUpdated) {
      // Record was deleted between our check and update - check if match exists now
      const matchCreatedConcurrently = await prisma.matches.findUnique({
        where: {
          draw_id_match_number: {
            draw_id: failedGame.drawId,
            match_number: failedGame.matchNumber,
          },
        },
      })

      return {
        success: true,
        alreadyResolved: true,
        message: matchCreatedConcurrently
          ? `Match ${failedGame.matchNumber} was processed by a concurrent sync.`
          : 'This failed game record was removed during retry.',
        matchId: matchCreatedConcurrently?.id,
      }
    }

    // Try to re-fetch the draw data from API
    const gameType = draw.game_type as GameType
    const apiClient = createApiClient(gameType)

    console.log(
      `[Admin] Retrying fetch for match ${failedGame.matchNumber} in draw ${draw.draw_number} (${gameType})`
    )

    try {
      // Fetch the current draw data
      const { draws } = await apiClient.fetchCurrentDraws()
      const drawData = draws.find(d => d.drawNumber === draw.draw_number)

      if (!drawData) {
        // Try historic draw if not in current
        const { draw: historicDraw } = await apiClient.fetchHistoricDraw(draw.draw_number)
        if (historicDraw) {
          // Process the specific match we're looking for
          const matchEvent = historicDraw.drawEvents?.find(
            e => e.eventNumber === failedGame.matchNumber
          )
          if (matchEvent) {
            await drawSyncService.processDrawData(historicDraw, gameType)

            // Mark as resolved (gracefully handle if already deleted by processDrawData)
            await failedGamesService.markResolvedSafe(id, 'api_retry')

            return {
              success: true,
              message: `Successfully re-fetched and processed match ${failedGame.matchNumber}`,
            }
          }
        }

        return {
          success: false,
          error: 'Draw data not found in API',
        }
      }

      // Find the specific match
      const matchEvent = drawData.drawEvents?.find(e => e.eventNumber === failedGame.matchNumber)

      if (!matchEvent) {
        return {
          success: false,
          error: `Match ${failedGame.matchNumber} not found in draw data`,
        }
      }

      // Re-process the entire draw (which will process the match)
      await drawSyncService.processDrawData(drawData, gameType)

      // If successful, the match should now exist
      const existingMatch = await prisma.matches.findUnique({
        where: {
          draw_id_match_number: {
            draw_id: failedGame.drawId,
            match_number: failedGame.matchNumber,
          },
        },
      })

      if (existingMatch) {
        // Mark as resolved (gracefully handle if already deleted by processDrawData)
        await failedGamesService.markResolvedSafe(id, 'api_retry')

        return {
          success: true,
          message: `Successfully re-fetched and processed match ${failedGame.matchNumber}`,
          matchId: existingMatch.id,
        }
      }

      return {
        success: false,
        error: 'Match was processed but not found in database',
      }
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Fetch failed'
      console.log(
        `[Admin] Svenska Spel API retry failed for match ${failedGame.matchNumber}, trying API-Football fallback...`
      )

      // Try API-Football as fallback source
      try {
        // First check if the match exists (it might have been created earlier but without result)
        const match = await prisma.matches.findUnique({
          where: {
            draw_id_match_number: {
              draw_id: failedGame.drawId,
              match_number: failedGame.matchNumber,
            },
          },
          select: { id: true, outcome: true },
        })

        if (match) {
          // Match exists - try to fetch result from API-Football
          const fetchResult = await resultFallbackService.syncMatchResult(match.id)

          if (fetchResult.fetchedResult?.isFinished) {
            // Update the match with the fetched result
            await prisma.matches.update({
              where: { id: match.id },
              data: {
                result_home: fetchResult.fetchedResult.homeGoals,
                result_away: fetchResult.fetchedResult.awayGoals,
                outcome: fetchResult.fetchedResult.outcome,
                status: 'Completed',
                status_time: new Date(),
                result_source: 'api-football',
              },
            })

            await failedGamesService.markResolvedSafe(id, 'api_football_fallback')

            return {
              success: true,
              message: `Result fetched from API-Football: ${fetchResult.fetchedResult.homeGoals}-${fetchResult.fetchedResult.awayGoals}`,
              matchId: match.id,
              source: 'api-football',
            }
          } else if (fetchResult.fetchedResult?.isTerminal) {
            // Match has terminal status (postponed, cancelled, etc.)
            await prisma.matches.update({
              where: { id: match.id },
              data: {
                status: fetchResult.fetchedResult.rawStatus,
                status_time: new Date(),
              },
            })

            await failedGamesService.markResolvedSafe(id, 'api_football_fallback')

            return {
              success: true,
              message: `Match status updated from API-Football: ${fetchResult.fetchedResult.rawStatus}`,
              matchId: match.id,
              source: 'api-football',
            }
          }
        }
      } catch (apiFootballError) {
        console.warn('[Admin] API-Football fallback also failed:', apiFootballError)
      }

      // Both sources failed - record the error
      await failedGamesService.recordFailedGame(
        failedGame.drawId,
        failedGame.matchNumber,
        gameType,
        'api_error',
        errorMessage
      )

      return {
        success: false,
        error: `Retry failed: ${errorMessage} (API-Football fallback also unavailable)`,
      }
    }
  } catch (error) {
    console.error(`[Admin] Error retrying failed game ${id}:`, error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to retry',
    })
  }
})
