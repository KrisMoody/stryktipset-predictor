import { aiMetricsService } from '~/server/services/ai-metrics-service'
import { requireAdmin } from '~/server/utils/require-admin'

export default defineEventHandler(async event => {
  await requireAdmin(event)

  try {
    const budget = await aiMetricsService.getBudgetAnalysis()

    return {
      success: true,
      data: budget,
    }
  } catch (error) {
    console.error('Error getting AI budget analysis:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
