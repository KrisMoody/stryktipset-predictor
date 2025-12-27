import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/require-admin'
import { drawLifecycle } from '~/server/services/draw-lifecycle'

export default defineEventHandler(async event => {
  await requireAdmin(event)

  try {
    // Get all current draws
    const currentDraws = await prisma.draws.findMany({
      where: { is_current: true },
      select: {
        id: true,
        draw_number: true,
        game_type: true,
        draw_date: true,
        close_time: true,
        status: true,
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

    // Check each draw's finalization status
    const drawsWithStatus = await Promise.all(
      currentDraws.map(async draw => {
        const matchesWithResults = draw.matches.filter(
          m => m.result_home !== null && m.result_away !== null && m.outcome !== null
        ).length
        const totalMatches = draw.matches.length

        const lifecycleStatus = await drawLifecycle.shouldArchive(draw.draw_number, draw.game_type)

        return {
          id: draw.id,
          draw_number: draw.draw_number,
          game_type: draw.game_type,
          draw_date: draw.draw_date,
          close_time: draw.close_time,
          status: draw.status,
          matchesWithResults,
          totalMatches,
          readyForFinalization: lifecycleStatus.should_archive,
          finalizationReason: lifecycleStatus.reason,
        }
      })
    )

    // Separate into ready and not ready
    const readyForFinalization = drawsWithStatus.filter(d => d.readyForFinalization)
    const notReady = drawsWithStatus.filter(d => !d.readyForFinalization)

    return {
      success: true,
      readyForFinalization,
      notReady,
      counts: {
        total: currentDraws.length,
        ready: readyForFinalization.length,
        notReady: notReady.length,
      },
    }
  } catch (error) {
    console.error('[Admin] Error fetching pending finalization draws:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to fetch pending draws',
    })
  }
})
