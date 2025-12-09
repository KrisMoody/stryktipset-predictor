import { predictionService } from '~/server/services/prediction-service'
import { drawCacheService } from '~/server/services/draw-cache-service'
import { prisma } from '~/server/utils/prisma'
import { isValidGameType, DEFAULT_GAME_TYPE } from '~/server/constants/game-configs'
import type { GameType } from '~/types/game-types'

interface PredictRequestBody {
  context?: string
  isReevaluation?: boolean
  gameType?: string
}

export default defineEventHandler(async event => {
  try {
    const matchId = parseInt(event.context.params?.id || '0')
    const body = await readBody<PredictRequestBody>(event).catch((): PredictRequestBody => ({}))

    const { context, isReevaluation = false, gameType: gameTypeParam } = body || {}

    // Validate gameType
    const gameType: GameType =
      gameTypeParam && isValidGameType(gameTypeParam) ? gameTypeParam : DEFAULT_GAME_TYPE

    const prediction = await predictionService.predictMatch(matchId, {
      userContext: context,
      isReevaluation,
      gameType,
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
      include: { draws: { select: { draw_number: true, game_type: true } } },
    })
    if (match?.draws?.draw_number) {
      const drawGameType = match.draws.game_type as GameType
      drawCacheService.invalidateDrawCache(match.draws.draw_number, drawGameType)
    }

    return {
      success: true,
      prediction,
      gameType,
    }
  } catch (error) {
    console.error('Error predicting match:', error)
    throw error
  }
})
