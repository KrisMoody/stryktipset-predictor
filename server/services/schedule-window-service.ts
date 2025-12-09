/**
 * Schedule Window Service
 *
 * Manages betting window scheduling for all game types (Stryktipset, Europatipset, Topptipset)
 * based on actual draw deadlines (close_time) from the database.
 *
 * - Uses per-draw deadline proximity instead of fixed day-of-week patterns
 * - Phases: early (>36h), mid (12-36h), late (<12h), closed (no active draws)
 * - Provides progressive scraping intensity based on proximity to spelstopp
 */

import type { GameType } from '~/types/game-types'
import { prisma } from '~/server/utils/prisma'

/**
 * Status for an individual draw
 */
export interface DrawScheduleStatus {
  drawNumber: number
  gameType: GameType
  closeTime: Date
  hoursUntilClose: number
  phase: 'early' | 'mid' | 'late' | 'closed'
  scrapingIntensity: 'normal' | 'aggressive' | 'very_aggressive'
  dataRefreshThreshold: number
}

/**
 * Global schedule window status (backward compatible + new fields)
 */
export interface ScheduleWindowStatus {
  isActive: boolean
  currentPhase: 'early' | 'mid' | 'late' | 'closed'
  closeTime: Date | null
  openTime: Date | null
  minutesUntilClose: number | null
  minutesUntilOpen: number | null
  scrapingIntensity: 'normal' | 'aggressive' | 'very_aggressive'
  dataRefreshThreshold: number // Hours
  reason: string
  stockholmTime: string
  // New fields for multi-draw awareness
  activeDraws: DrawScheduleStatus[]
  nearestDraw: DrawScheduleStatus | null
}

export interface ScheduleOperationPermission {
  allowed: boolean
  reason: string
}

// Intensity thresholds (hours before close)
const LATE_PHASE_HOURS = 12
const MID_PHASE_HOURS = 36

// Cache configuration
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

interface ActiveDraw {
  gameType: string
  drawNumber: number
  closeTime: Date
}

class ScheduleWindowService {
  private activeDrawsCache: ActiveDraw[] = []
  private cacheExpiry: Date = new Date(0)

  /**
   * Get current time in Stockholm timezone
   */
  getStockholmTime(): Date {
    const stockholmTime = new Date().toLocaleString('en-US', {
      timeZone: 'Europe/Stockholm',
    })
    return new Date(stockholmTime)
  }

  /**
   * Fetch active draws from database
   */
  private async getActiveDrawsFromDB(): Promise<ActiveDraw[]> {
    const now = new Date()
    const draws = await prisma.draws.findMany({
      where: {
        status: 'Open',
        close_time: { gt: now },
      },
      select: {
        game_type: true,
        draw_number: true,
        close_time: true,
      },
      orderBy: { close_time: 'asc' },
    })
    return draws
      .filter(d => d.close_time !== null)
      .map(d => ({
        gameType: d.game_type,
        drawNumber: d.draw_number,
        closeTime: d.close_time as Date,
      }))
  }

  /**
   * Get cached active draws (synchronous for hot paths)
   */
  private getCachedActiveDraws(): ActiveDraw[] {
    return this.activeDrawsCache
  }

  /**
   * Refresh the active draws cache from database
   * Should be called periodically by the scheduler
   */
  async refreshActiveDrawsCache(): Promise<void> {
    const now = new Date()
    if (now < this.cacheExpiry) {
      return // Cache still valid
    }

    try {
      this.activeDrawsCache = await this.getActiveDrawsFromDB()
      this.cacheExpiry = new Date(Date.now() + CACHE_DURATION_MS)
      console.log(`[ScheduleWindow] Cache refreshed: ${this.activeDrawsCache.length} active draws`)
    } catch (error) {
      console.error('[ScheduleWindow] Failed to refresh cache:', error)
      // Keep stale cache on error, but try again sooner
      this.cacheExpiry = new Date(Date.now() + 60 * 1000) // Retry in 1 minute
    }
  }

  /**
   * Force cache refresh (ignores expiry)
   */
  async forceRefreshCache(): Promise<void> {
    this.cacheExpiry = new Date(0)
    await this.refreshActiveDrawsCache()
  }

  /**
   * Calculate phase based on hours until close
   */
  private getPhaseForHoursUntilClose(hours: number): 'early' | 'mid' | 'late' | 'closed' {
    if (hours <= 0) return 'closed'
    if (hours <= LATE_PHASE_HOURS) return 'late'
    if (hours <= MID_PHASE_HOURS) return 'mid'
    return 'early'
  }

  /**
   * Get scraping intensity from phase
   */
  private intensityFromPhase(
    phase: 'early' | 'mid' | 'late' | 'closed'
  ): 'normal' | 'aggressive' | 'very_aggressive' {
    switch (phase) {
      case 'late':
        return 'very_aggressive'
      case 'mid':
        return 'aggressive'
      default:
        return 'normal'
    }
  }

  /**
   * Get data refresh threshold from phase
   */
  private thresholdFromPhase(phase: 'early' | 'mid' | 'late' | 'closed'): number {
    switch (phase) {
      case 'late':
        return 4 // Refresh data older than 4 hours
      case 'mid':
        return 12 // Refresh data older than 12 hours
      default:
        return 24 // Refresh data older than 24 hours
    }
  }

  /**
   * Get schedule status for an individual draw
   */
  getDrawScheduleStatus(draw: ActiveDraw): DrawScheduleStatus {
    const now = this.getStockholmTime()
    const hoursUntilClose = (draw.closeTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    const phase = this.getPhaseForHoursUntilClose(hoursUntilClose)

    return {
      drawNumber: draw.drawNumber,
      gameType: draw.gameType as GameType,
      closeTime: draw.closeTime,
      hoursUntilClose,
      phase,
      scrapingIntensity: this.intensityFromPhase(phase),
      dataRefreshThreshold: this.thresholdFromPhase(phase),
    }
  }

  /**
   * Get the next close time (nearest active draw deadline)
   */
  getNextCloseTime(_fromDate?: Date): Date | null {
    const now = this.getStockholmTime()
    const draws = this.getCachedActiveDraws()
    const futureDraw = draws.find(d => d.closeTime > now)
    return futureDraw?.closeTime || null
  }

  /**
   * Check if currently within an active betting window (any draw is open)
   */
  isInActiveWindow(): boolean {
    const now = this.getStockholmTime()
    const draws = this.getCachedActiveDraws()
    return draws.some(draw => draw.closeTime > now)
  }

  /**
   * Get the current phase based on nearest deadline
   */
  getCurrentPhase(): 'early' | 'mid' | 'late' | 'closed' {
    const now = this.getStockholmTime()
    const draws = this.getCachedActiveDraws()

    if (draws.length === 0) return 'closed'

    const nearestDraw = draws.find(d => d.closeTime > now)
    if (!nearestDraw) return 'closed'

    const hoursUntilClose = (nearestDraw.closeTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    return this.getPhaseForHoursUntilClose(hoursUntilClose)
  }

  /**
   * Get scraping intensity based on current phase
   */
  getScrapingIntensity(): 'normal' | 'aggressive' | 'very_aggressive' {
    return this.intensityFromPhase(this.getCurrentPhase())
  }

  /**
   * Get data refresh threshold in hours based on current phase
   */
  getDataRefreshThreshold(): number {
    return this.thresholdFromPhase(this.getCurrentPhase())
  }

  /**
   * Generate human-readable status reason
   */
  private generateReason(nearestDraw: DrawScheduleStatus | null): string {
    if (!nearestDraw) {
      return 'No active draws. Normal operations.'
    }

    const h = Math.floor(nearestDraw.hoursUntilClose)
    const game = nearestDraw.gameType.charAt(0).toUpperCase() + nearestDraw.gameType.slice(1)

    switch (nearestDraw.phase) {
      case 'late':
        return `${game} #${nearestDraw.drawNumber} closes in ${h}h. Aggressive data refresh.`
      case 'mid':
        return `${game} #${nearestDraw.drawNumber} closes in ${h}h. Moderate refresh rate.`
      case 'early':
        return `${game} #${nearestDraw.drawNumber} - ${h}h until close. Normal operations.`
      default:
        return 'Outside active window.'
    }
  }

  /**
   * Get complete window status (sync version using cache)
   * @param gameType - Optional game type to filter by. If not provided, returns status for nearest deadline across all games.
   */
  getWindowStatus(gameType?: GameType): ScheduleWindowStatus {
    const now = this.getStockholmTime()
    const draws = this.getCachedActiveDraws()

    // Filter by game type if specified
    const filteredDraws = gameType ? draws.filter(d => d.gameType === gameType) : draws

    const activeDrawStatuses = filteredDraws
      .filter(d => d.closeTime > now)
      .map(d => this.getDrawScheduleStatus(d))

    const nearestDraw = activeDrawStatuses[0] || null
    const isActive = activeDrawStatuses.length > 0

    return {
      isActive,
      currentPhase: nearestDraw?.phase || 'closed',
      closeTime: nearestDraw?.closeTime || null,
      openTime: null, // Could be enhanced to query upcoming draws
      minutesUntilClose: nearestDraw
        ? Math.floor((nearestDraw.closeTime.getTime() - now.getTime()) / (1000 * 60))
        : null,
      minutesUntilOpen: null,
      scrapingIntensity: nearestDraw?.scrapingIntensity || 'normal',
      dataRefreshThreshold: nearestDraw?.dataRefreshThreshold || 24,
      reason: this.generateReason(nearestDraw),
      stockholmTime: now.toISOString(),
      activeDraws: activeDrawStatuses,
      nearestDraw,
    }
  }

  /**
   * Get complete window status (async version that refreshes cache first)
   * @param gameType - Optional game type to filter by
   */
  async getWindowStatusAsync(gameType?: GameType): Promise<ScheduleWindowStatus> {
    await this.refreshActiveDrawsCache()
    return this.getWindowStatus(gameType)
  }

  /**
   * Check if an operation should be allowed
   */
  shouldAllowOperation(
    operationType: string,
    adminOverride: boolean = false
  ): ScheduleOperationPermission {
    if (adminOverride) {
      return {
        allowed: true,
        reason: 'Admin override enabled.',
      }
    }

    if (this.isInActiveWindow()) {
      return {
        allowed: true,
        reason: 'Within active betting window.',
      }
    }

    // Outside window - check operation type
    const readOnlyOperations = ['health-check', 'metrics', 'status']
    if (readOnlyOperations.includes(operationType)) {
      return {
        allowed: true,
        reason: 'Read-only operation allowed outside window.',
      }
    }

    return {
      allowed: false,
      reason: `${this.generateReason(null)} Enable admin override to proceed.`,
    }
  }
}

// Export singleton instance
export const scheduleWindowService = new ScheduleWindowService()
