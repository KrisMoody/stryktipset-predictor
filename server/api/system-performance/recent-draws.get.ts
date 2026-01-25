import { prisma } from '~/server/utils/prisma'

/**
 * GET /api/system-performance/recent-draws
 * Get recent completed draws with results summary
 */
export default defineEventHandler(async event => {
  const query = getQuery(event)
  const limit = Math.min(parseInt(query.limit as string) || 5, 20)
  const systemType = query.systemType as 'R' | 'U' | undefined

  try {
    // Get unique draw numbers that have analyzed performances
    const whereClause: { analyzed_at: { not: null }; system_type?: string } = {
      analyzed_at: { not: null },
    }

    if (systemType) {
      whereClause.system_type = systemType
    }

    const performances = await prisma.system_performance.findMany({
      where: whereClause,
      orderBy: { draw_number: 'desc' },
      select: {
        draw_number: true,
        system_id: true,
        system_type: true,
        correct_row: true,
        best_score: true,
        winning_rows: true,
        payout: true,
        roi: true,
        final_cost: true,
        analyzed_at: true,
      },
    })

    // Group by draw number and get best result per draw
    const drawMap = new Map<
      number,
      {
        drawNumber: number
        correctRow: string | null
        systems: Array<{
          systemId: string
          systemType: string
          bestScore: number
          winningRows: number
          payout: number
          roi: number
          cost: number
        }>
        bestScore: number
        totalPayout: number
        totalCost: number
        analyzedAt: Date | null
      }
    >()

    for (const perf of performances) {
      if (!drawMap.has(perf.draw_number)) {
        drawMap.set(perf.draw_number, {
          drawNumber: perf.draw_number,
          correctRow: perf.correct_row,
          systems: [],
          bestScore: 0,
          totalPayout: 0,
          totalCost: 0,
          analyzedAt: perf.analyzed_at,
        })
      }

      const draw = drawMap.get(perf.draw_number)!
      draw.systems.push({
        systemId: perf.system_id,
        systemType: perf.system_type,
        bestScore: perf.best_score || 0,
        winningRows: perf.winning_rows || 0,
        payout: Number(perf.payout || 0),
        roi: Number(perf.roi || 0),
        cost: perf.final_cost,
      })

      draw.bestScore = Math.max(draw.bestScore, perf.best_score || 0)
      draw.totalPayout += Number(perf.payout || 0)
      draw.totalCost += perf.final_cost
    }

    // Convert to array and take top N
    const recentDraws = Array.from(drawMap.values())
      .sort((a, b) => b.drawNumber - a.drawNumber)
      .slice(0, limit)
      .map(draw => ({
        ...draw,
        overallRoi: draw.totalCost > 0
          ? ((draw.totalPayout - draw.totalCost) / draw.totalCost) * 100
          : 0,
      }))

    return {
      success: true,
      draws: recentDraws,
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Failed to get recent draws:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get recent draws',
      data: { error: err.message },
    })
  }
})
