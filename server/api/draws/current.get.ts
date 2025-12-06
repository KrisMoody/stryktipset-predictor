import { drawCacheService } from '~/server/services/draw-cache-service'

export default defineEventHandler(async _event => {
  try {
    // Fetch from cache (or database if cache miss)
    const draws = await drawCacheService.getCachedCurrentDraws()

    return {
      success: true,
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
