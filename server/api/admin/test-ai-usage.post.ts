import { testAIUsageWrite } from '../../utils/test-ai-usage-write'
import { requireAdmin } from '~/server/utils/require-admin'

export default defineEventHandler(async event => {
  await requireAdmin(event)

  try {
    const result = await testAIUsageWrite()

    return {
      success: result.success,
      message: result.message,
      error: result.error,
      details: result.details,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    return {
      success: false,
      message: 'Test endpoint failed with exception',
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }
  }
})
