import { aiUsageMetrics } from '../../utils/ai-usage-metrics'

export default defineEventHandler(async _event => {
  try {
    const metrics = aiUsageMetrics.getMetrics()

    return {
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    return {
      success: false,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }
  }
})
