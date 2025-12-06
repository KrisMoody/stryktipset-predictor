import { aiMetricsService } from '~/server/services/ai-metrics-service'
import type { DateRangeFilter } from '~/types'

export default defineEventHandler(async event => {
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

    const [modelBreakdown, operationBreakdown] = await Promise.all([
      aiMetricsService.getCostsByModel(dateRange),
      aiMetricsService.getCostsByDataType(dateRange),
    ])

    return {
      success: true,
      data: {
        byModel: modelBreakdown,
        byOperation: operationBreakdown,
      },
    }
  } catch (error) {
    console.error('Error getting AI cost breakdowns:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
