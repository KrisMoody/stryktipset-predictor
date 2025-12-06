import { systemPerformanceAnalyzer } from '~/server/services/system-performance-analyzer'

export default defineEventHandler(async (event) => {
  const systemId = getRouterParam(event, 'systemId')

  if (!systemId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'System ID is required',
    })
  }

  try {
    const stats = await systemPerformanceAnalyzer.getSystemStats(systemId)
    const trend = await systemPerformanceAnalyzer.getPerformanceTrend(systemId, 20)

    if (!stats) {
      return {
        success: true,
        stats: null,
        trend: [],
        message: 'No performance data available for this system',
      }
    }

    return {
      success: true,
      stats,
      trend,
    }
  }
  catch (error: any) {
    console.error(`Failed to get performance for system ${systemId}:`, error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get system performance',
      data: { error: error.message },
    })
  }
})
