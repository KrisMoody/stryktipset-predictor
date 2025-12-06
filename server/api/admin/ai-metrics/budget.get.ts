import { aiMetricsService } from '~/server/services/ai-metrics-service'

export default defineEventHandler(async (_event) => {
  try {
    const budget = await aiMetricsService.getBudgetAnalysis()

    return {
      success: true,
      data: budget,
    }
  }
  catch (error) {
    console.error('Error getting AI budget analysis:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
