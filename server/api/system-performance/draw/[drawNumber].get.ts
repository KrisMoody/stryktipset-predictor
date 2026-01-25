import { prisma } from '~/server/utils/prisma'
import type { CouponRow } from '~/types'

/**
 * GET /api/system-performance/draw/:drawNumber
 * Get completed draw results including correct row and generated coupons
 */
export default defineEventHandler(async event => {
  const drawNumber = getRouterParam(event, 'drawNumber')

  if (!drawNumber || isNaN(parseInt(drawNumber))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Valid draw number is required',
    })
  }

  const drawNum = parseInt(drawNumber)

  try {
    // Get draw info with matches
    const draw = await prisma.draws.findFirst({
      where: { draw_number: drawNum },
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
      return {
        success: false,
        error: 'Draw not found',
      }
    }

    // Get the correct row from match outcomes
    const correctRow = draw.matches.map(m => m.outcome || '?').join('')

    // Check if all matches have outcomes
    const isComplete = draw.matches.every(m => m.outcome)

    // Get all system performances for this draw
    const performances = await prisma.system_performance.findMany({
      where: {
        draw_number: drawNum,
        analyzed_at: { not: null },
      },
      orderBy: { created_at: 'desc' },
    })

    // Get generated coupons for each performance
    const couponsWithResults = await Promise.all(
      performances.map(async perf => {
        const coupon = await prisma.generated_coupons.findFirst({
          where: { performance_id: perf.id },
        })

        return {
          systemId: perf.system_id,
          systemType: perf.system_type,
          rows: coupon ? (coupon.rows as unknown as CouponRow[]) : [],
          bestScore: perf.best_score || 0,
          winningRows: perf.winning_rows || 0,
          scoreDistribution: (perf.score_distribution as Record<number, number>) || {},
          payout: Number(perf.payout || 0),
          roi: Number(perf.roi || 0),
          analyzedAt: perf.analyzed_at,
        }
      })
    )

    // Match details for display
    const matchDetails = draw.matches.map(m => ({
      matchNumber: m.match_number,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      result:
        m.result_home !== null && m.result_away !== null
          ? `${m.result_home}-${m.result_away}`
          : null,
      outcome: m.outcome,
    }))

    return {
      success: true,
      drawNumber: drawNum,
      drawDate: draw.draw_date,
      status: draw.status,
      isComplete,
      correctRow,
      matchDetails,
      coupons: couponsWithResults,
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error(`Failed to get draw results for ${drawNumber}:`, error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get draw results',
      data: { error: err.message },
    })
  }
})
