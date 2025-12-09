import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/require-admin'

export default defineEventHandler(async event => {
  // Require admin access
  await requireAdmin(event)

  try {
    const currentDraws = await prisma.draws.findMany({
      where: { is_current: true },
      select: {
        draw_number: true,
        draw_date: true,
        close_time: true,
        status: true,
        is_current: true,
        matches: {
          select: {
            result_home: true,
            result_away: true,
            outcome: true,
          },
        },
      },
      orderBy: { draw_number: 'desc' },
    })

    // Transform to include match result counts
    const draws = currentDraws.map(draw => {
      const matchesWithResults = draw.matches.filter(
        m => m.result_home !== null && m.result_away !== null && m.outcome !== null
      ).length
      const totalMatches = draw.matches.length

      return {
        draw_number: draw.draw_number,
        draw_date: draw.draw_date,
        close_time: draw.close_time,
        status: draw.status,
        is_current: draw.is_current,
        matchesWithResults,
        totalMatches,
      }
    })

    return {
      success: true,
      draws,
      count: draws.length,
    }
  } catch (error) {
    console.error('[Admin] Error fetching current draws:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to fetch current draws',
    })
  }
})
