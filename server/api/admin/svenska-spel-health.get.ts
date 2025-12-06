import { svenskaSpelApi } from '~/server/services/svenska-spel-api'

/**
 * Health check endpoint for Svenska Spel API
 * Tests connectivity and response time
 */
export default defineEventHandler(async (_event) => {
  const startTime = Date.now()

  try {
    // Test the API by fetching current draws
    const { draws } = await svenskaSpelApi.fetchCurrentDraws()
    const responseTime = Date.now() - startTime

    return {
      success: true,
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      drawsAvailable: draws?.length || 0,
      apiEndpoint: 'https://api.spela.svenskaspel.se/draw/1',
      timestamp: new Date().toISOString(),
      message: 'Svenska Spel API is operational',
    }
  }
  catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Categorize error
    let errorCategory = 'UNKNOWN'
    if (errorMessage.toLowerCase().includes('timeout')) {
      errorCategory = 'TIMEOUT'
    }
    else if (errorMessage.toLowerCase().includes('fetch failed') || errorMessage.toLowerCase().includes('econnrefused')) {
      errorCategory = 'CONNECTION'
    }
    else if (errorMessage.toLowerCase().includes('404')) {
      errorCategory = 'NOT_FOUND'
    }
    else if (errorMessage.toLowerCase().includes('500') || errorMessage.toLowerCase().includes('502')) {
      errorCategory = 'SERVER_ERROR'
    }

    console.error(`[Svenska Spel Health] API health check failed [${errorCategory}]:`, errorMessage)

    return {
      success: false,
      status: 'unhealthy',
      errorCategory,
      responseTime: `${responseTime}ms`,
      apiEndpoint: 'https://api.spela.svenskaspel.se/draw/1',
      timestamp: new Date().toISOString(),
      error: errorMessage,
      message: `Svenska Spel API is experiencing issues: ${errorCategory}`,
    }
  }
})
