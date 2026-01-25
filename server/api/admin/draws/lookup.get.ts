import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/require-admin'
import type { GameType } from '~/types'

export default defineEventHandler(async event => {
  await requireAdmin(event)

  const query = getQuery(event)
  const drawNumber = parseInt(query.drawNumber as string, 10)
  const gameType = (query.gameType as GameType) || 'stryktipset'

  if (!drawNumber || isNaN(drawNumber)) {
    throw createError({
      statusCode: 400,
      message: 'Draw number is required',
    })
  }

  try {
    // Look up draw with all related data
    const draw = await prisma.draws.findUnique({
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
              take: 3, // Get latest of each type
            },
            predictions: {
              select: {
                probability_home: true,
                probability_draw: true,
                probability_away: true,
                predicted_outcome: true,
                confidence: true,
              },
              orderBy: { created_at: 'desc' },
              take: 1,
            },
          },
          orderBy: { match_number: 'asc' },
        },
      },
    })

    if (!draw) {
      return {
        success: true,
        found: false,
        drawNumber,
        gameType,
        message: `Draw ${drawNumber} (${gameType}) not found in local database`,
      }
    }

    // Transform matches to include latest odds by type
    const matchesWithOdds = draw.matches.map((match: (typeof draw.matches)[number]) => {
      const currentOdds = match.match_odds.find(
        (o: (typeof match.match_odds)[number]) => o.type === 'current'
      )
      const startOdds = match.match_odds.find(
        (o: (typeof match.match_odds)[number]) => o.type === 'start'
      )
      const prediction = match.predictions[0] || null

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
        prediction: prediction
          ? {
              home: prediction.probability_home,
              draw: prediction.probability_draw,
              away: prediction.probability_away,
              recommended: prediction.predicted_outcome,
              confidence: prediction.confidence,
            }
          : null,
      }
    })

    // Count matches with results
    const matchesWithResults = draw.matches.filter(
      (m: (typeof draw.matches)[number]) => m.result_home !== null && m.result_away !== null
    ).length

    return {
      success: true,
      found: true,
      draw: {
        id: draw.id,
        drawNumber: draw.draw_number,
        gameType: draw.game_type,
        drawDate: draw.draw_date,
        closeTime: draw.close_time,
        status: draw.status,
        isCurrent: draw.is_current,
        netSale: draw.net_sale,
        totalMatches: draw.matches.length,
        matchesWithResults,
        matches: matchesWithOdds,
      },
    }
  } catch (error) {
    console.error('[Admin] Error looking up draw:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to lookup draw',
    })
  }
})
