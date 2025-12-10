import { cacheService } from './cache-service'
import { prisma } from '~/server/utils/prisma'
import type { GameType } from '~/types/game-types'
import { DEFAULT_GAME_TYPE } from '~/types/game-types'

/**
 * Draw-specific caching service
 *
 * Wraps database queries for draws with caching logic including:
 * - Automatic cache key management
 * - Cache stampede prevention
 * - Selective cache invalidation
 * - Multi-game support (Stryktipset, Europatipset, Topptipset)
 */
class DrawCacheService {
  private readonly CACHE_VERSION = 'v2'

  /**
   * Get cache key for current draws by game type
   */
  private getCurrentDrawsKey(gameType: GameType): string {
    return `draws:current:${gameType}:${this.CACHE_VERSION}`
  }

  /**
   * Get cache key for a specific draw
   */
  private getDrawKey(gameType: GameType, drawNumber: number): string {
    return `draw:${gameType}:${drawNumber}:${this.CACHE_VERSION}`
  }

  /**
   * Get current draws with caching
   *
   * Returns list of current (non-archived) draws with active status, limited to 5 most recent.
   * Includes all relations: matches, teams, leagues, predictions, odds.
   * @param gameType - The game type to fetch draws for (defaults to 'stryktipset')
   */
  async getCachedCurrentDraws(gameType: GameType = DEFAULT_GAME_TYPE) {
    return await cacheService.wrap(this.getCurrentDrawsKey(gameType), async () => {
      console.log(`[Draw Cache] Fetching current ${gameType} draws from database...`)

      const draws = await prisma.draws.findMany({
        where: {
          game_type: gameType,
          is_current: true,
          status: {
            in: ['Open', 'Closed', 'Ready'],
          },
        },
        include: {
          matches: {
            orderBy: { match_number: 'asc' },
            include: {
              homeTeam: true,
              awayTeam: true,
              league: {
                include: {
                  country: true,
                },
              },
              predictions: {
                orderBy: { created_at: 'desc' },
                take: 1,
              },
              match_odds: {
                where: { type: 'current' },
                orderBy: { collected_at: 'desc' },
              },
            },
          },
        },
        orderBy: { draw_number: 'desc' },
        take: 5,
      })

      console.log(`[Draw Cache] Fetched ${draws.length} current ${gameType} draws from database`)
      return draws
    })
  }

  /**
   * Get specific draw by number with caching
   *
   * Returns single draw with all relations including scraped data.
   * Returns null if draw not found.
   * @param drawNumber - The draw number to fetch
   * @param gameType - The game type (defaults to 'stryktipset')
   */
  async getCachedDraw(drawNumber: number, gameType: GameType = DEFAULT_GAME_TYPE) {
    return await cacheService.wrap(this.getDrawKey(gameType, drawNumber), async () => {
      console.log(`[Draw Cache] Fetching ${gameType} draw ${drawNumber} from database...`)

      const draw = await prisma.draws.findUnique({
        where: { game_type_draw_number: { game_type: gameType, draw_number: drawNumber } },
        include: {
          matches: {
            orderBy: { match_number: 'asc' },
            include: {
              homeTeam: true,
              awayTeam: true,
              league: {
                include: {
                  country: true,
                },
              },
              predictions: {
                orderBy: { created_at: 'desc' },
                take: 1,
              },
              match_odds: {
                where: { type: 'current' },
                orderBy: { collected_at: 'desc' },
              },
              match_scraped_data: true,
            },
          },
        },
      })

      if (draw) {
        console.log(`[Draw Cache] Fetched ${gameType} draw ${drawNumber} from database`)
      } else {
        console.log(`[Draw Cache] ${gameType} draw ${drawNumber} not found in database`)
      }

      return draw
    })
  }

  /**
   * Invalidate cache for current draws list
   * @param gameType - Optional game type. If not provided, invalidates all game types.
   */
  invalidateCurrentDrawsCache(gameType?: GameType): void {
    if (gameType) {
      console.log(`[Draw Cache] Invalidating current ${gameType} draws cache`)
      cacheService.del(this.getCurrentDrawsKey(gameType))
    } else {
      console.log('[Draw Cache] Invalidating current draws cache for all game types')
      cacheService.delPattern('draws:current:')
    }
  }

  /**
   * Invalidate cache for specific draw
   * @param drawNumber - The draw number
   * @param gameType - The game type (defaults to 'stryktipset')
   */
  invalidateDrawCache(drawNumber: number, gameType: GameType = DEFAULT_GAME_TYPE): void {
    console.log(`[Draw Cache] Invalidating ${gameType} draw ${drawNumber} cache`)
    cacheService.del(this.getDrawKey(gameType, drawNumber))
  }

  /**
   * Invalidate all draw-related cache
   *
   * Clears both current draws list and all individual draw caches for all game types.
   */
  invalidateAllDrawCache(): void {
    console.log('[Draw Cache] Invalidating all draw caches')

    // Delete all current draws caches
    cacheService.delPattern('draws:current:')

    // Delete all individual draw caches (pattern match)
    cacheService.delPattern('draw:')
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return cacheService.getStats()
  }
}

// Export singleton instance
export const drawCacheService = new DrawCacheService()
