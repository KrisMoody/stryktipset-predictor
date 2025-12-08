import { aiUsageMetrics } from '../../utils/ai-usage-metrics'
import { requireAdmin } from '~/server/utils/require-admin'

export default defineEventHandler(async event => {
  await requireAdmin(event)

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
