/**
 * Schedule Window Service
 *
 * Manages the Stryktipset betting window schedule:
 * - Active window: Tuesday 00:00 → Saturday 15:59 (Stockholm timezone)
 * - Outside window: Sunday, Monday, Saturday after 16:00
 *
 * Provides progressive scraping intensity based on proximity to spelstopp.
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
}

export interface ScheduleOperationPermission {
  allowed: boolean
  reason: string
}

// Window configuration
const WINDOW_OPEN_DAY = 2 // Tuesday
const WINDOW_OPEN_HOUR = 0
const WINDOW_OPEN_MINUTE = 0

const WINDOW_CLOSE_DAY = 6 // Saturday
const WINDOW_CLOSE_HOUR = 15
const WINDOW_CLOSE_MINUTE = 59

// Intensity thresholds (hours before close)
const LATE_PHASE_HOURS = 12 // Saturday morning
const MID_PHASE_HOURS = 36 // Friday

class ScheduleWindowService {
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
   * Get the next spelstopp time (Saturday 15:59)
   */
  getNextCloseTime(fromDate?: Date): Date {
    const now = fromDate || this.getStockholmTime()
    const close = new Date(now)

    // Set to Saturday 15:59:59
    close.setHours(WINDOW_CLOSE_HOUR, WINDOW_CLOSE_MINUTE, 59, 999)

    // Find next Saturday
    const daysUntilSaturday = (WINDOW_CLOSE_DAY - close.getDay() + 7) % 7
    close.setDate(close.getDate() + daysUntilSaturday)

    // If we're past this Saturday's close time, get next week's
    if (close <= now) {
      close.setDate(close.getDate() + 7)
    }

    return close
  }

  /**
   * Get the next window open time (Tuesday 00:00)
   */
  getNextOpenTime(fromDate?: Date): Date {
    const now = fromDate || this.getStockholmTime()
    const open = new Date(now)

    // Set to Tuesday 00:00:00
    open.setHours(WINDOW_OPEN_HOUR, WINDOW_OPEN_MINUTE, 0, 0)

    // Find next Tuesday
    const daysUntilTuesday = (WINDOW_OPEN_DAY - open.getDay() + 7) % 7
    open.setDate(open.getDate() + daysUntilTuesday)

    // If we're past this Tuesday's open time but still in the window, get next week's
    if (open <= now) {
      // Check if we're still in the active window (before Saturday 16:00)
      const closeTime = this.getNextCloseTime(now)
      if (now < closeTime && now.getDay() >= WINDOW_OPEN_DAY && now.getDay() <= WINDOW_CLOSE_DAY) {
        // We're in the window, next open is next week
        open.setDate(open.getDate() + 7)
      } else if (daysUntilTuesday === 0) {
        // It's Tuesday but we've passed 00:00, get next Tuesday
        open.setDate(open.getDate() + 7)
      }
    }

    return open
  }

  /**
   * Check if currently within the active betting window
   */
  isInActiveWindow(): boolean {
    const now = this.getStockholmTime()
    const dayOfWeek = now.getDay() // 0=Sunday, 6=Saturday
    const hour = now.getHours()
    const minute = now.getMinutes()

    // Sunday (0) or Monday (1) - outside window
    if (dayOfWeek === 0 || dayOfWeek === 1) {
      return false
    }

    // Saturday (6) - check if before 16:00
    if (dayOfWeek === WINDOW_CLOSE_DAY) {
      if (hour > WINDOW_CLOSE_HOUR) {
        return false
      }
      if (hour === WINDOW_CLOSE_HOUR && minute > WINDOW_CLOSE_MINUTE) {
        return false
      }
    }

    // Tuesday (2) through Friday (5) or Saturday before 16:00 - active
    return true
  }

  /**
   * Get the current phase based on time until close
   */
  getCurrentPhase(): 'early' | 'mid' | 'late' | 'closed' {
    if (!this.isInActiveWindow()) {
      return 'closed'
    }

    const now = this.getStockholmTime()
    const closeTime = this.getNextCloseTime(now)
    const hoursUntilClose = (closeTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursUntilClose <= LATE_PHASE_HOURS) {
      return 'late' // Saturday morning - very aggressive
    }
    if (hoursUntilClose <= MID_PHASE_HOURS) {
      return 'mid' // Friday - aggressive
    }
    return 'early' // Tuesday-Thursday - normal
  }

  /**
   * Get scraping intensity based on current phase
   */
  getScrapingIntensity(): 'normal' | 'aggressive' | 'very_aggressive' {
    const phase = this.getCurrentPhase()
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
   * Get data refresh threshold in hours based on current phase
   */
  getDataRefreshThreshold(): number {
    const phase = this.getCurrentPhase()
    switch (phase) {
      case 'late':
        return 4 // Refresh data older than 4 hours on Saturday morning
      case 'mid':
        return 12 // Refresh data older than 12 hours on Friday
      default:
        return 24 // Refresh data older than 24 hours Tue-Thu
    }
  }

  /**
   * Get human-readable status reason
   */
  getStatusReason(): string {
    const now = this.getStockholmTime()
    const dayOfWeek = now.getDay()
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    if (!this.isInActiveWindow()) {
      if (dayOfWeek === 0) {
        return 'Sunday - new coupon may be opening. Light sync only.'
      }
      if (dayOfWeek === 1) {
        return 'Monday - waiting for Tuesday match list publication.'
      }
      if (dayOfWeek === 6) {
        return 'Saturday after spelstopp - betting window closed.'
      }
      return 'Outside betting window.'
    }

    const phase = this.getCurrentPhase()
    const closeTime = this.getNextCloseTime(now)
    const hoursUntilClose = Math.floor((closeTime.getTime() - now.getTime()) / (1000 * 60 * 60))

    switch (phase) {
      case 'late':
        return `${dayNames[dayOfWeek]} - ${hoursUntilClose}h until spelstopp. Aggressive data refresh.`
      case 'mid':
        return `${dayNames[dayOfWeek]} - betting tips being published. Moderate refresh rate.`
      case 'early':
        return `${dayNames[dayOfWeek]} - match list published. Normal operations.`
      default:
        return 'Active betting window.'
    }
  }

  /**
   * Get complete window status
   */
  getWindowStatus(): ScheduleWindowStatus {
    const now = this.getStockholmTime()
    const isActive = this.isInActiveWindow()
    const phase = this.getCurrentPhase()

    let closeTime: Date | null = null
    let openTime: Date | null = null
    let minutesUntilClose: number | null = null
    let minutesUntilOpen: number | null = null

    if (isActive) {
      closeTime = this.getNextCloseTime(now)
      minutesUntilClose = Math.floor((closeTime.getTime() - now.getTime()) / (1000 * 60))
    } else {
      openTime = this.getNextOpenTime(now)
      minutesUntilOpen = Math.floor((openTime.getTime() - now.getTime()) / (1000 * 60))
    }

    return {
      isActive,
      currentPhase: phase,
      closeTime,
      openTime,
      minutesUntilClose,
      minutesUntilOpen,
      scrapingIntensity: this.getScrapingIntensity(),
      dataRefreshThreshold: this.getDataRefreshThreshold(),
      reason: this.getStatusReason(),
      stockholmTime: now.toISOString(),
    }
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
      reason: `${this.getStatusReason()} Enable admin override to proceed.`,
    }
  }
}

// Export singleton instance
export const scheduleWindowService = new ScheduleWindowService()
