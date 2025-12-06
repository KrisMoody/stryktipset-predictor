import { scheduleWindowService } from '~/server/services/schedule-window-service'

export default defineEventHandler(async () => {
  try {
    const status = scheduleWindowService.getWindowStatus()

    return {
      success: true,
      status: {
        isActive: status.isActive,
        currentPhase: status.currentPhase,
        closeTime: status.closeTime?.toISOString() ?? null,
        openTime: status.openTime?.toISOString() ?? null,
        minutesUntilClose: status.minutesUntilClose,
        minutesUntilOpen: status.minutesUntilOpen,
        scrapingIntensity: status.scrapingIntensity,
        dataRefreshThreshold: status.dataRefreshThreshold,
        reason: status.reason,
        stockholmTime: status.stockholmTime,
      },
    }
  }
  catch (error) {
    console.error('[Schedule Status] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
