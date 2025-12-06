import { drawCacheService } from '~/server/services/draw-cache-service'

export default defineEventHandler(async (event) => {
  try {
    const drawNumber = parseInt(event.context.params?.drawNumber || '0')

    // Fetch from cache (or database if cache miss)
    const draw = await drawCacheService.getCachedDraw(drawNumber)

    if (!draw) {
      throw createError({
        statusCode: 404,
        message: `Draw ${drawNumber} not found`,
      })
    }

    return {
      success: true,
      draw,
    }
  }
  catch (error) {
    console.error('Error fetching draw:', error)
    throw error
  }
})
