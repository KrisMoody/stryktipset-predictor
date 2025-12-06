import { cacheService } from './cache-service'
import { prisma } from '~/server/utils/prisma'

/**
 * Draw-specific caching service
 *
 * Wraps database queries for draws with caching logic including:
 * - Automatic cache key management
 * - Cache stampede prevention
 * - Selective cache invalidation
 */
class DrawCacheService {
  private readonly CACHE_VERSION = 'v1'
  private readonly CURRENT_DRAWS_KEY = `draws:current:${this.CACHE_VERSION}`

  /**
   * Get cache key for a specific draw
   */
  private getDrawKey(drawNumber: number): string {
    return `draw:${drawNumber}:${this.CACHE_VERSION}`
  }

  /**
   * Get current draws with caching
   *
   * Returns list of draws with status 'Open' or 'Closed', limited to 5 most recent.
   * Includes all relations: matches, teams, leagues, predictions, odds.
   */
  async getCachedCurrentDraws() {
    return await cacheService.wrap(
      this.CURRENT_DRAWS_KEY,
      async () => {
        console.log('[Draw Cache] Fetching current draws from database...')

        const draws = await prisma.draws.findMany({
          where: {
            status: {
              in: ['Open', 'Closed'],
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
                  orderBy: { collected_at: 'desc' },
                },
              },
            },
          },
          orderBy: { draw_number: 'desc' },
          take: 5,
        })

        console.log(`[Draw Cache] Fetched ${draws.length} current draws from database`)
        return draws
      },
    )
  }

  /**
   * Get specific draw by number with caching
   *
   * Returns single draw with all relations including scraped data.
   * Returns null if draw not found.
   */
  async getCachedDraw(drawNumber: number) {
    return await cacheService.wrap(
      this.getDrawKey(drawNumber),
      async () => {
        console.log(`[Draw Cache] Fetching draw ${drawNumber} from database...`)

        const draw = await prisma.draws.findUnique({
          where: { draw_number: drawNumber },
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
                  orderBy: { collected_at: 'desc' },
                },
                match_scraped_data: true,
              },
            },
          },
        })

        if (draw) {
          console.log(`[Draw Cache] Fetched draw ${drawNumber} from database`)
        }
        else {
          console.log(`[Draw Cache] Draw ${drawNumber} not found in database`)
        }

        return draw
      },
    )
  }

  /**
   * Invalidate cache for current draws list
   */
  invalidateCurrentDrawsCache(): void {
    console.log('[Draw Cache] Invalidating current draws cache')
    cacheService.del(this.CURRENT_DRAWS_KEY)
  }

  /**
   * Invalidate cache for specific draw
   */
  invalidateDrawCache(drawNumber: number): void {
    console.log(`[Draw Cache] Invalidating draw ${drawNumber} cache`)
    cacheService.del(this.getDrawKey(drawNumber))
  }

  /**
   * Invalidate all draw-related cache
   *
   * Clears both current draws list and all individual draw caches.
   */
  invalidateAllDrawCache(): void {
    console.log('[Draw Cache] Invalidating all draw caches')

    // Delete current draws cache
    cacheService.del(this.CURRENT_DRAWS_KEY)

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
