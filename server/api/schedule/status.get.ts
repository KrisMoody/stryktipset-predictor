import { scheduleWindowService } from '~/server/services/schedule-window-service'
import { isValidGameType } from '~/server/constants/game-configs'
import type { GameType } from '~/types/game-types'

export default defineEventHandler(async event => {
  try {
    const query = getQuery(event)
    const gameTypeParam = query.gameType as string | undefined

    // Validate game type if provided
    let gameType: GameType | undefined
    if (gameTypeParam) {
      if (!isValidGameType(gameTypeParam)) {
        return {
          success: false,
          error: `Invalid game type: ${gameTypeParam}. Valid types: stryktipset, europatipset, topptipset`,
        }
      }
      gameType = gameTypeParam
    }

    const status = scheduleWindowService.getWindowStatus(gameType)

    return {
      success: true,
      gameType: gameType || 'all',
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
        activeDraws: status.activeDraws.map(d => ({
          drawNumber: d.drawNumber,
          gameType: d.gameType,
          closeTime: d.closeTime.toISOString(),
          hoursUntilClose: d.hoursUntilClose,
          phase: d.phase,
        })),
        nearestDraw: status.nearestDraw
          ? {
              drawNumber: status.nearestDraw.drawNumber,
              gameType: status.nearestDraw.gameType,
              closeTime: status.nearestDraw.closeTime.toISOString(),
              hoursUntilClose: status.nearestDraw.hoursUntilClose,
              phase: status.nearestDraw.phase,
            }
          : null,
      },
    }
  } catch (error) {
    console.error('[Schedule Status] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
