import { drawCacheService } from '~/server/services/draw-cache-service'
import { isValidGameType, DEFAULT_GAME_TYPE } from '~/types/game-types'
import type { GameType } from '~/types/game-types'

export default defineEventHandler(async event => {
  try {
    // Get optional gameType query parameter
    const query = getQuery(event)
    const gameTypeParam = query.gameType as string | undefined
    const gameType: GameType =
      gameTypeParam && isValidGameType(gameTypeParam) ? gameTypeParam : DEFAULT_GAME_TYPE

    // Fetch from cache (or database if cache miss)
    const draws = await drawCacheService.getCachedCurrentDraws(gameType)

    return {
      success: true,
      gameType,
      draws,
    }
  } catch (error) {
    console.error('Error fetching current draws:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
