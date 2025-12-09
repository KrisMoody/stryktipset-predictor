import { drawCacheService } from '~/server/services/draw-cache-service'
import { isValidGameType, DEFAULT_GAME_TYPE } from '~/types/game-types'
import type { GameType } from '~/types/game-types'

export default defineEventHandler(async event => {
  try {
    const drawNumber = parseInt(event.context.params?.drawNumber || '0')

    // Get optional gameType query parameter
    const query = getQuery(event)
    const gameTypeParam = query.gameType as string | undefined
    const gameType: GameType =
      gameTypeParam && isValidGameType(gameTypeParam) ? gameTypeParam : DEFAULT_GAME_TYPE

    // Fetch from cache (or database if cache miss)
    const draw = await drawCacheService.getCachedDraw(drawNumber, gameType)

    if (!draw) {
      throw createError({
        statusCode: 404,
        message: `${gameType} draw ${drawNumber} not found`,
      })
    }

    return {
      success: true,
      gameType,
      draw,
    }
  } catch (error) {
    console.error('Error fetching draw:', error)
    throw error
  }
})
