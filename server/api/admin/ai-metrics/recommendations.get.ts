import { aiMetricsService } from '~/server/services/ai-metrics-service'
import { requireAdmin } from '~/server/utils/require-admin'
import type { DateRangeFilter } from '~/types'

export default defineEventHandler(async event => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)

    // Parse date range from query params
    let dateRange: DateRangeFilter | undefined
    if (query.start && query.end) {
      dateRange = {
        start: new Date(query.start as string),
        end: new Date(query.end as string),
      }
    }

    const recommendations = await aiMetricsService.getOptimizationRecommendations(dateRange)

    return {
      success: true,
      data: recommendations,
    }
  } catch (error) {
    console.error('Error getting AI optimization recommendations:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
