import { requireAdmin } from '~/server/utils/require-admin'
import { failedGamesService } from '~/server/services/failed-games-service'
import { drawSyncService } from '~/server/services/draw-sync'
import { createApiClient } from '~/server/services/svenska-spel-api'
import { prisma } from '~/server/utils/prisma'
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
      return {
        success: false,
        error: 'Failed game record not found',
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

    // Update status to retry_scheduled
    await failedGamesService.updateStatus(id, 'retry_scheduled')

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

            // Mark as resolved
            await failedGamesService.markResolved(id, 'api_retry')

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
        // Mark as resolved
        await failedGamesService.markResolved(id, 'api_retry')

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
      // Update the failed game record with the new error
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Fetch failed'
      await failedGamesService.recordFailedGame(
        failedGame.drawId,
        failedGame.matchNumber,
        gameType,
        'api_error',
        errorMessage
      )

      return {
        success: false,
        error: `Retry failed: ${errorMessage}`,
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
