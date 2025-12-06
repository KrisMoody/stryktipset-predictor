import { aiMetricsService } from '~/server/services/ai-metrics-service'
import type { DateRangeFilter } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)

    // Parse date range from query params
    let dateRange: DateRangeFilter | undefined
    if (query.start && query.end) {
      dateRange = {
        start: new Date(query.start as string),
        end: new Date(query.end as string),
        preset: query.preset as any,
      }
    }
    else if (query.preset) {
      dateRange = parseDatePreset(query.preset as string)
    }

    const overview = await aiMetricsService.getOverallStats(dateRange)

    return {
      success: true,
      data: overview,
    }
  }
  catch (error) {
    console.error('Error getting AI metrics overview:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})

function parseDatePreset(preset: string): DateRangeFilter {
  const now = new Date()
  const start = new Date()

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      break
    case '7days':
      start.setDate(now.getDate() - 7)
      break
    case '30days':
      start.setDate(now.getDate() - 30)
      break
    case 'thisMonth':
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      break
    case 'lastMonth':
      start.setMonth(now.getMonth() - 1)
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
      return { start, end, preset: preset as any }
    default:
      // All time - last 90 days
      start.setDate(now.getDate() - 90)
  }

  return { start, end: now, preset: preset as any }
}
