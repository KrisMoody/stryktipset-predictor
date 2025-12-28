import { requireAdmin } from '~/server/utils/require-admin'
import { drawSyncService } from '~/server/services/draw-sync'
import { createApiClient } from '~/server/services/svenska-spel-api'
import { prisma } from '~/server/utils/prisma'
import { isValidGameType } from '~/server/constants/game-configs'
import type { GameType } from '~/types/game-types'

export default defineEventHandler(async event => {
  await requireAdmin(event)

  const drawIdParam = getRouterParam(event, 'drawId')
  const matchNumberParam = getRouterParam(event, 'matchNumber')

  const drawId = Number(drawIdParam)
  const matchNumber = Number(matchNumberParam)

  if (isNaN(drawId) || drawId <= 0) {
    throw createError({
      statusCode: 400,
      message: 'Invalid draw ID',
    })
  }

  if (isNaN(matchNumber) || matchNumber <= 0) {
    throw createError({
      statusCode: 400,
      message: 'Invalid match number',
    })
  }

  try {
    const body = await readBody<{ gameType?: string }>(event)

    // Get the draw to find draw number and game type
    const draw = await prisma.draws.findUnique({
      where: { id: drawId },
      select: { draw_number: true, game_type: true },
    })

    if (!draw) {
      return {
        success: false,
        error: 'Draw not found',
      }
    }

    // Use provided game type or fall back to draw's game type
    const gameType = (
      body?.gameType && isValidGameType(body.gameType) ? body.gameType : draw.game_type
    ) as GameType

    console.log(`[Admin] Fetching match ${matchNumber} for draw ${draw.draw_number} (${gameType})`)

    // Check if match already exists
    const existingMatch = await prisma.matches.findUnique({
      where: {
        draw_id_match_number: {
          draw_id: drawId,
          match_number: matchNumber,
        },
      },
    })

    if (existingMatch) {
      return {
        success: true,
        message: 'Match already exists',
        matchId: existingMatch.id,
        alreadyExists: true,
      }
    }

    // Fetch from API
    const apiClient = createApiClient(gameType)

    // Try current draws first
    const { draws } = await apiClient.fetchCurrentDraws()
    let drawData = draws.find(d => d.drawNumber === draw.draw_number)

    // If not in current, try historic
    if (!drawData) {
      const { draw: historicDraw } = await apiClient.fetchHistoricDraw(draw.draw_number)
      if (historicDraw) {
        drawData = historicDraw
      }
    }

    if (!drawData) {
      return {
        success: false,
        error: 'Draw data not found in Svenska Spel API',
      }
    }

    // Find the specific match
    const matchEvent = drawData.drawEvents?.find(e => e.eventNumber === matchNumber)

    if (!matchEvent) {
      return {
        success: false,
        error: `Match ${matchNumber} not found in API response`,
      }
    }

    // Process the entire draw (which will process the missing match)
    await drawSyncService.processDrawData(drawData, gameType)

    // Verify the match was created
    const newMatch = await prisma.matches.findUnique({
      where: {
        draw_id_match_number: {
          draw_id: drawId,
          match_number: matchNumber,
        },
      },
    })

    if (newMatch) {
      return {
        success: true,
        message: `Successfully fetched and created match ${matchNumber}`,
        matchId: newMatch.id,
      }
    }

    return {
      success: false,
      error: 'Match was processed but not found in database',
    }
  } catch (error) {
    console.error(`[Admin] Error fetching match ${matchNumber} for draw ${drawId}:`, error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to fetch match',
    })
  }
})
