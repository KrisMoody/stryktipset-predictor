import { performanceTracker } from '~/server/services/performance-tracker'

export default defineEventHandler(async _event => {
  try {
    // Update performance first
    await performanceTracker.updatePerformance()

    // Get stats
    const stats = await performanceTracker.getOverallStats()

    return {
      success: true,
      stats,
    }
  } catch (error) {
    console.error('Error getting performance summary:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
