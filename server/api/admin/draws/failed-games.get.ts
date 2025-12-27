import { requireAdmin } from '~/server/utils/require-admin'
import { failedGamesService } from '~/server/services/failed-games-service'
import { isValidGameType } from '~/server/constants/game-configs'
import type { GameType } from '~/types/game-types'

export default defineEventHandler(async event => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    const gameTypeParam = query.gameType as string | undefined

    // Validate game type if provided
    let gameType: GameType | undefined
    if (gameTypeParam && isValidGameType(gameTypeParam)) {
      gameType = gameTypeParam
    }

    // Get pending failed games
    const failedGames = await failedGamesService.getPendingFailedGames(gameType)

    // Get incomplete draws summary
    const incompleteDraws = await failedGamesService.getAllIncompleteDraws()

    return {
      success: true,
      failedGames,
      incompleteDraws,
      counts: {
        pendingGames: failedGames.length,
        incompleteDraws: incompleteDraws.length,
      },
    }
  } catch (error) {
    console.error('[Admin] Error fetching failed games:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to fetch failed games',
    })
  }
})
