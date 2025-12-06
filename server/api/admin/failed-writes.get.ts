import { failedWritesQueue } from '../../utils/failed-writes-queue'
import { retryFailedWrites } from '../../utils/ai-usage-recorder'

export default defineEventHandler(async event => {
  try {
    const query = getQuery(event)
    const action = query.action as string | undefined

    // Handle actions
    if (action === 'retry') {
      const results = await retryFailedWrites()
      return {
        success: true,
        action: 'retry',
        results,
        queueStatus: failedWritesQueue.getStatus(),
        timestamp: new Date().toISOString(),
      }
    }

    if (action === 'clear') {
      failedWritesQueue.clear()
      return {
        success: true,
        action: 'clear',
        message: 'Failed writes queue cleared',
        timestamp: new Date().toISOString(),
      }
    }

    // Default: return queue status
    return {
      success: true,
      queueStatus: failedWritesQueue.getStatus(),
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
