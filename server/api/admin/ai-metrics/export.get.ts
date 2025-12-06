import { prisma } from '~/server/utils/prisma'
import type { AIMetricsExportData } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)

    // Build where clause based on date range
    const whereClause: any = {}

    if (query.preset) {
      const dateRange = parseDatePreset(query.preset as string)
      whereClause.timestamp = {
        gte: dateRange.start,
        lte: dateRange.end,
      }
    }
    else if (query.start && query.end) {
      whereClause.timestamp = {
        gte: new Date(query.start as string),
        lte: new Date(query.end as string),
      }
    }

    // Fetch all AI usage records
    const records = await prisma.ai_usage.findMany({
      where: whereClause,
      orderBy: {
        timestamp: 'desc',
      },
      take: 10000, // Limit to prevent memory issues
    })

    // Transform to export format
    const exportData: AIMetricsExportData[] = records.map(record => ({
      timestamp: record.timestamp,
      model: record.model,
      dataType: record.data_type || 'unknown',
      operationId: record.operation_id || 'unknown',
      inputTokens: record.input_tokens,
      outputTokens: record.output_tokens,
      totalTokens: record.input_tokens + record.output_tokens,
      cost: Number(record.cost_usd),
      duration: record.duration_ms || 0,
      success: record.success,
      endpoint: record.endpoint || 'unknown',
    }))

    return {
      success: true,
      data: exportData,
    }
  }
  catch (error) {
    console.error('Error exporting AI metrics:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})

function parseDatePreset(preset: string): { start: Date, end: Date } {
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
      return { start, end }
    default:
      // All time - last 90 days
      start.setDate(now.getDate() - 90)
  }

  return { start, end: now }
}
