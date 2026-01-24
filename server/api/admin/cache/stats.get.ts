import { cacheService } from '~/server/services/cache-service'
import { requireAdmin } from '~/server/utils/require-admin'

export default defineEventHandler(async event => {
  await requireAdmin(event)

  try {
    const stats = cacheService.getStats()

    return {
      success: true,
      stats: {
        keys: stats.keys,
        hits: stats.stats.hits,
        misses: stats.stats.misses,
        inflightRequests: stats.inflightRequests,
      },
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error getting cache stats:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
