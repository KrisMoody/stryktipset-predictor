import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/require-admin'
import { createApiClient } from '~/server/services/svenska-spel-api'
import { drawSyncService } from '~/server/services/draw-sync'
import type { GameType } from '~/types'

export default defineEventHandler(async event => {
  await requireAdmin(event)

  const drawNumber = parseInt(getRouterParam(event, 'drawNumber') || '', 10)
  const body = await readBody<{ gameType?: GameType }>(event)
  const gameType: GameType = body?.gameType || 'stryktipset'

  if (!drawNumber || isNaN(drawNumber)) {
    throw createError({
      statusCode: 400,
      message: 'Valid draw number is required',
    })
  }

  try {
    console.log(`[Admin] Fetching draw ${drawNumber} (${gameType}) from Svenska Spel API...`)

    // First check if draw already exists locally
    const existingDraw = await prisma.draws.findUnique({
      where: {
        game_type_draw_number: {
          game_type: gameType,
          draw_number: drawNumber,
        },
      },
      select: { id: true },
    })

    // Fetch from Svenska Spel API
    const apiClient = createApiClient(gameType)
    const { draw: drawData } = await apiClient.fetchDrawWithMultifetch(drawNumber, true)

    if (!drawData) {
      throw createError({
        statusCode: 404,
        message: `Draw ${drawNumber} (${gameType}) not found in Svenska Spel API`,
      })
    }

    // Process and sync the draw using the draw sync service
    const syncResult = await drawSyncService.processDrawData(drawData, gameType)

    if (!syncResult.success) {
      throw createError({
        statusCode: 500,
        message: syncResult.error || 'Failed to sync draw data',
      })
    }

    // Fetch the synced draw with all data
    const syncedDraw = await prisma.draws.findUnique({
      where: {
        game_type_draw_number: {
          game_type: gameType,
          draw_number: drawNumber,
        },
      },
      select: {
        id: true,
        draw_number: true,
        game_type: true,
        draw_date: true,
        close_time: true,
        status: true,
        is_current: true,
        net_sale: true,
        matches: {
          select: {
            id: true,
            match_number: true,
            match_id: true,
            start_time: true,
            status: true,
            result_home: true,
            result_away: true,
            outcome: true,
            homeTeam: {
              select: {
                id: true,
                name: true,
                short_name: true,
              },
            },
            awayTeam: {
              select: {
                id: true,
                name: true,
                short_name: true,
              },
            },
            league: {
              select: {
                id: true,
                name: true,
                country: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            match_odds: {
              select: {
                type: true,
                home_odds: true,
                draw_odds: true,
                away_odds: true,
                svenska_folket_home: true,
                svenska_folket_draw: true,
                svenska_folket_away: true,
                tio_tidningars_tips_home: true,
                tio_tidningars_tips_draw: true,
                tio_tidningars_tips_away: true,
                collected_at: true,
              },
              orderBy: { collected_at: 'desc' },
              take: 3,
            },
          },
          orderBy: { match_number: 'asc' },
        },
      },
    })

    if (!syncedDraw) {
      throw createError({
        statusCode: 500,
        message: 'Draw was synced but could not be retrieved',
      })
    }

    // Transform matches
    const matchesWithOdds = syncedDraw.matches.map((match: (typeof syncedDraw.matches)[number]) => {
      const currentOdds = match.match_odds.find(
        (o: (typeof match.match_odds)[number]) => o.type === 'current'
      )
      const startOdds = match.match_odds.find(
        (o: (typeof match.match_odds)[number]) => o.type === 'start'
      )

      return {
        id: match.id,
        matchNumber: match.match_number,
        matchId: match.match_id,
        startTime: match.start_time,
        status: match.status,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league,
        result: {
          home: match.result_home,
          away: match.result_away,
          outcome: match.outcome,
        },
        odds: {
          current: currentOdds
            ? {
                home: currentOdds.home_odds,
                draw: currentOdds.draw_odds,
                away: currentOdds.away_odds,
              }
            : null,
          start: startOdds
            ? {
                home: startOdds.home_odds,
                draw: startOdds.draw_odds,
                away: startOdds.away_odds,
              }
            : null,
        },
        svenskaFolket: currentOdds
          ? {
              home: currentOdds.svenska_folket_home,
              draw: currentOdds.svenska_folket_draw,
              away: currentOdds.svenska_folket_away,
            }
          : null,
        expertTips: currentOdds
          ? {
              home: currentOdds.tio_tidningars_tips_home,
              draw: currentOdds.tio_tidningars_tips_draw,
              away: currentOdds.tio_tidningars_tips_away,
            }
          : null,
      }
    })

    const matchesWithResults = syncedDraw.matches.filter(
      (m: (typeof syncedDraw.matches)[number]) => m.result_home !== null && m.result_away !== null
    ).length

    console.log(
      `[Admin] Successfully fetched draw ${drawNumber} (${gameType}): ${syncResult.matchesProcessed} matches`
    )

    return {
      success: true,
      action: existingDraw ? 'refreshed' : 'created',
      draw: {
        id: syncedDraw.id,
        drawNumber: syncedDraw.draw_number,
        gameType: syncedDraw.game_type,
        drawDate: syncedDraw.draw_date,
        closeTime: syncedDraw.close_time,
        status: syncedDraw.status,
        isCurrent: syncedDraw.is_current,
        netSale: syncedDraw.net_sale,
        totalMatches: syncedDraw.matches.length,
        matchesWithResults,
        matches: matchesWithOdds,
      },
    }
  } catch (error) {
    console.error(`[Admin] Error fetching draw ${drawNumber} (${gameType}):`, error)

    // Check for 404-like errors from API
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      throw createError({
        statusCode: 404,
        message: `Draw ${drawNumber} (${gameType}) does not exist in Svenska Spel`,
      })
    }

    throw createError({
      statusCode: 500,
      message: errorMessage,
    })
  }
})
