import { scraperService } from '~/server/services/scraper/scraper-service'

export default defineEventHandler(async (_event) => {
  try {
    const health = await scraperService.getHealthMetrics()

    return {
      success: true,
      health,
    }
  }
  catch (error) {
    console.error('Error getting scraper health:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
