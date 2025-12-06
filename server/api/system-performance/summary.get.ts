import { systemPerformanceAnalyzer } from '~/server/services/system-performance-analyzer'

export default defineEventHandler(async () => {
  try {
    const overallStats = await systemPerformanceAnalyzer.getOverallStats()
    const leaderboard = await systemPerformanceAnalyzer.getLeaderboard(10)
    const recentTrend = await systemPerformanceAnalyzer.getPerformanceTrend(undefined, 20)

    return {
      success: true,
      stats: overallStats,
      leaderboard,
      recentTrend,
    }
  }
  catch (error: any) {
    console.error('Failed to get system performance summary:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get system performance summary',
      data: { error: error.message },
    })
  }
})
