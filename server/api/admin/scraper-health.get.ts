import { scraperService } from '~/server/services/scraper/scraper-service'
import { requireAdmin } from '~/server/utils/require-admin'

export default defineEventHandler(async event => {
  await requireAdmin(event)

  try {
    const health = await scraperService.getHealthMetrics()

    return {
      success: true,
      health,
    }
  } catch (error) {
    console.error('Error getting scraper health:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
