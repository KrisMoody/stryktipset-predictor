import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async event => {
  const drawNumber = parseInt(event.context.params?.drawNumber || '0')

  if (!drawNumber) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Draw number is required',
    })
  }

  try {
    // Get draw with matches and team relations
    const draw = await prisma.draws.findFirst({
      where: { draw_number: drawNumber },
      include: {
        matches: {
          orderBy: { match_number: 'asc' },
          include: {
            homeTeam: true,
            awayTeam: true,
          },
        },
      },
    })

    if (!draw) {
      throw createError({
        statusCode: 404,
        statusMessage: `Draw ${drawNumber} not found`,
      })
    }

    // Build correct row from match outcomes
    const outcomes = draw.matches.map(m => m.outcome)
    const correctRow = outcomes.every(o => o) ? outcomes.join('') : null

    // Get system performance records with results
    const performances = await prisma.system_performance.findMany({
      where: {
        draw_number: drawNumber,
        analyzed_at: { not: null },
      },
      orderBy: { best_score: 'desc' },
    })

    // Get generated coupons for this draw
    const coupons = await prisma.generated_coupons.findMany({
      where: { draw_number: drawNumber },
    })

    // Build results per system
    const systemResults = performances.map(perf => {
      const coupon = coupons.find(c => c.system_id === perf.system_id)

      return {
        systemId: perf.system_id,
        systemType: perf.system_type,
        correctRow: perf.correct_row,
        bestScore: perf.best_score,
        winningRows: perf.winning_rows,
        scoreDistribution: perf.score_distribution as Record<number, number> | null,
        payout: Number(perf.payout || 0),
        roi: Number(perf.roi || 0),
        cost: perf.final_cost,
        rows: coupon?.rows || [],
        analyzedAt: perf.analyzed_at,
      }
    })

    // Try to extract payout info from raw_data if available
    const rawData = draw.raw_data as { prizes?: Record<string, number> } | null
    const payoutInfo = rawData?.prizes
      ? {
          '13': rawData.prizes['13'] || 0,
          '12': rawData.prizes['12'] || 0,
          '11': rawData.prizes['11'] || 0,
          '10': rawData.prizes['10'] || 0,
        }
      : null

    return {
      success: true,
      drawNumber,
      correctRow,
      isComplete: !!correctRow,
      matches: draw.matches.map(m => ({
        matchNumber: m.match_number,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        outcome: m.outcome,
        homeScore: m.result_home,
        awayScore: m.result_away,
      })),
      payoutInfo,
      systemResults,
    }
  } catch (error: unknown) {
    const err = error as { message?: string; statusCode?: number }
    if (err.statusCode) throw error
    console.error(`Failed to get results for draw ${drawNumber}:`, error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get draw results',
      data: { error: err.message },
    })
  }
})
