import { predictionService } from '~/server/services/prediction-service'
import { drawCacheService } from '~/server/services/draw-cache-service'
import { prisma } from '~/server/utils/prisma'

interface PredictRequestBody {
  context?: string
  isReevaluation?: boolean
}

export default defineEventHandler(async (event) => {
  try {
    const matchId = parseInt(event.context.params?.id || '0')
    const body = await readBody<PredictRequestBody>(event).catch((): PredictRequestBody => ({}))

    const { context, isReevaluation = false } = body || {}

    const prediction = await predictionService.predictMatch(matchId, {
      userContext: context,
      isReevaluation,
    })

    if (!prediction) {
      throw createError({
        statusCode: 500,
        message: 'Failed to generate prediction',
      })
    }

    // Invalidate draw cache so refresh() returns fresh data
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: { draws: { select: { draw_number: true } } },
    })
    if (match?.draws?.draw_number) {
      drawCacheService.invalidateDrawCache(match.draws.draw_number)
    }

    return {
      success: true,
      prediction,
    }
  }
  catch (error) {
    console.error('Error predicting match:', error)
    throw error
  }
})
