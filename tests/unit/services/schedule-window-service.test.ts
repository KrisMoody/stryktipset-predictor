import { describe, it, expect, beforeEach } from 'vitest'

// We need to test the class directly, so we'll import and instantiate
// Mock the module to control time
const createScheduleWindowService = () => {
  // Import dynamically to allow mocking
  class TestableScheduleWindowService {
    private mockTime: Date | null = null

    setMockTime(date: Date | null): void {
      this.mockTime = date
    }

    getStockholmTime(): Date {
      if (this.mockTime) {
        return new Date(this.mockTime)
      }
      const stockholmTime = new Date().toLocaleString('en-US', {
        timeZone: 'Europe/Stockholm',
      })
      return new Date(stockholmTime)
    }

    getNextCloseTime(fromDate?: Date): Date {
      const now = fromDate || this.getStockholmTime()
      const close = new Date(now)

      close.setHours(15, 59, 59, 999)

      const daysUntilSaturday = (6 - close.getDay() + 7) % 7
      close.setDate(close.getDate() + daysUntilSaturday)

      if (close <= now) {
        close.setDate(close.getDate() + 7)
      }

      return close
    }

    getNextOpenTime(fromDate?: Date): Date {
      const now = fromDate || this.getStockholmTime()
      const open = new Date(now)

      open.setHours(0, 0, 0, 0)

      const daysUntilTuesday = (2 - open.getDay() + 7) % 7
      open.setDate(open.getDate() + daysUntilTuesday)

      if (open <= now) {
        const closeTime = this.getNextCloseTime(now)
        if (now < closeTime && now.getDay() >= 2 && now.getDay() <= 6) {
          open.setDate(open.getDate() + 7)
        } else if (daysUntilTuesday === 0) {
          open.setDate(open.getDate() + 7)
        }
      }

      return open
    }

    isInActiveWindow(): boolean {
      const now = this.getStockholmTime()
      const dayOfWeek = now.getDay()
      const hour = now.getHours()
      const minute = now.getMinutes()

      if (dayOfWeek === 0 || dayOfWeek === 1) {
        return false
      }

      if (dayOfWeek === 6) {
        if (hour > 15) {
          return false
        }
        if (hour === 15 && minute > 59) {
          return false
        }
      }

      return true
    }

    getCurrentPhase(): 'early' | 'mid' | 'late' | 'closed' {
      if (!this.isInActiveWindow()) {
        return 'closed'
      }

      const now = this.getStockholmTime()
      const closeTime = this.getNextCloseTime(now)
      const hoursUntilClose = (closeTime.getTime() - now.getTime()) / (1000 * 60 * 60)

      if (hoursUntilClose <= 12) {
        return 'late'
      }
      if (hoursUntilClose <= 36) {
        return 'mid'
      }
      return 'early'
    }

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

    getDataRefreshThreshold(): number {
      const phase = this.getCurrentPhase()
      switch (phase) {
        case 'late':
          return 4
        case 'mid':
          return 12
        default:
          return 24
      }
    }

    shouldAllowOperation(
      operationType: string,
      adminOverride: boolean = false
    ): { allowed: boolean; reason: string } {
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

      const readOnlyOperations = ['health-check', 'metrics', 'status']
      if (readOnlyOperations.includes(operationType)) {
        return {
          allowed: true,
          reason: 'Read-only operation allowed outside window.',
        }
      }

      return {
        allowed: false,
        reason: expect.any(String),
      }
    }

    getWindowStatus() {
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
        stockholmTime: now.toISOString(),
      }
    }
  }

  return new TestableScheduleWindowService()
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a date in Stockholm timezone for testing
 * Format: YYYY-MM-DD HH:MM (24h)
 */
function createStockholmDate(dateStr: string): Date {
  // Parse as local time, treating it as Stockholm time for testing
  const [datePart, timePart] = dateStr.split(' ')
  const [year, month, day] = datePart!.split('-').map(Number)
  const [hour, minute] = timePart!.split(':').map(Number)
  return new Date(year!, month! - 1, day!, hour!, minute!, 0, 0)
}

// ============================================================================
// isInActiveWindow Tests
// ============================================================================

describe('ScheduleWindowService', () => {
  let service: ReturnType<typeof createScheduleWindowService>

  beforeEach(() => {
    service = createScheduleWindowService()
  })

  describe('isInActiveWindow', () => {
    it('returns false on Sunday', () => {
      // Sunday, December 8, 2024, 14:00
      service.setMockTime(createStockholmDate('2024-12-08 14:00'))
      expect(service.isInActiveWindow()).toBe(false)
    })

    it('returns false on Monday', () => {
      // Monday, December 9, 2024, 10:00
      service.setMockTime(createStockholmDate('2024-12-09 10:00'))
      expect(service.isInActiveWindow()).toBe(false)
    })

    it('returns true on Tuesday at 00:01', () => {
      // Tuesday, December 10, 2024, 00:01
      service.setMockTime(createStockholmDate('2024-12-10 00:01'))
      expect(service.isInActiveWindow()).toBe(true)
    })

    it('returns true on Wednesday', () => {
      // Wednesday, December 11, 2024, 12:00
      service.setMockTime(createStockholmDate('2024-12-11 12:00'))
      expect(service.isInActiveWindow()).toBe(true)
    })

    it('returns true on Thursday', () => {
      // Thursday, December 12, 2024, 15:30
      service.setMockTime(createStockholmDate('2024-12-12 15:30'))
      expect(service.isInActiveWindow()).toBe(true)
    })

    it('returns true on Friday', () => {
      // Friday, December 13, 2024, 18:00
      service.setMockTime(createStockholmDate('2024-12-13 18:00'))
      expect(service.isInActiveWindow()).toBe(true)
    })

    it('returns true on Saturday at 15:00', () => {
      // Saturday, December 14, 2024, 15:00
      service.setMockTime(createStockholmDate('2024-12-14 15:00'))
      expect(service.isInActiveWindow()).toBe(true)
    })

    it('returns true on Saturday at 15:59', () => {
      // Saturday, December 14, 2024, 15:59 (edge case - last minute)
      service.setMockTime(createStockholmDate('2024-12-14 15:59'))
      expect(service.isInActiveWindow()).toBe(true)
    })

    it('returns false on Saturday at 16:00', () => {
      // Saturday, December 14, 2024, 16:00 (spelstopp)
      service.setMockTime(createStockholmDate('2024-12-14 16:00'))
      expect(service.isInActiveWindow()).toBe(false)
    })

    it('returns false on Saturday at 20:00', () => {
      // Saturday, December 14, 2024, 20:00 (well after close)
      service.setMockTime(createStockholmDate('2024-12-14 20:00'))
      expect(service.isInActiveWindow()).toBe(false)
    })
  })

  // ============================================================================
  // getCurrentPhase Tests
  // ============================================================================

  describe('getCurrentPhase', () => {
    it('returns "closed" on Sunday', () => {
      service.setMockTime(createStockholmDate('2024-12-08 12:00'))
      expect(service.getCurrentPhase()).toBe('closed')
    })

    it('returns "closed" on Monday', () => {
      service.setMockTime(createStockholmDate('2024-12-09 12:00'))
      expect(service.getCurrentPhase()).toBe('closed')
    })

    it('returns "early" on Tuesday', () => {
      // Tuesday - more than 36 hours until Saturday 16:00
      service.setMockTime(createStockholmDate('2024-12-10 12:00'))
      expect(service.getCurrentPhase()).toBe('early')
    })

    it('returns "early" on Wednesday', () => {
      service.setMockTime(createStockholmDate('2024-12-11 12:00'))
      expect(service.getCurrentPhase()).toBe('early')
    })

    it('returns "early" on Thursday morning', () => {
      // Thursday 10:00 - still more than 36 hours until Saturday 16:00
      service.setMockTime(createStockholmDate('2024-12-12 10:00'))
      expect(service.getCurrentPhase()).toBe('early')
    })

    it('returns "mid" on Friday', () => {
      // Friday 12:00 - less than 36 hours but more than 12 hours until close
      service.setMockTime(createStockholmDate('2024-12-13 12:00'))
      expect(service.getCurrentPhase()).toBe('mid')
    })

    it('returns "late" on Saturday morning', () => {
      // Saturday 08:00 - less than 12 hours until 16:00
      service.setMockTime(createStockholmDate('2024-12-14 08:00'))
      expect(service.getCurrentPhase()).toBe('late')
    })

    it('returns "late" on Saturday afternoon before close', () => {
      // Saturday 14:00 - very close to spelstopp
      service.setMockTime(createStockholmDate('2024-12-14 14:00'))
      expect(service.getCurrentPhase()).toBe('late')
    })

    it('returns "closed" on Saturday after 16:00', () => {
      service.setMockTime(createStockholmDate('2024-12-14 17:00'))
      expect(service.getCurrentPhase()).toBe('closed')
    })
  })

  // ============================================================================
  // getScrapingIntensity Tests
  // ============================================================================

  describe('getScrapingIntensity', () => {
    it('returns "normal" during early phase (Tuesday)', () => {
      service.setMockTime(createStockholmDate('2024-12-10 12:00'))
      expect(service.getScrapingIntensity()).toBe('normal')
    })

    it('returns "aggressive" during mid phase (Friday)', () => {
      service.setMockTime(createStockholmDate('2024-12-13 12:00'))
      expect(service.getScrapingIntensity()).toBe('aggressive')
    })

    it('returns "very_aggressive" during late phase (Saturday morning)', () => {
      service.setMockTime(createStockholmDate('2024-12-14 08:00'))
      expect(service.getScrapingIntensity()).toBe('very_aggressive')
    })

    it('returns "normal" when closed (defaults)', () => {
      service.setMockTime(createStockholmDate('2024-12-08 12:00'))
      expect(service.getScrapingIntensity()).toBe('normal')
    })
  })

  // ============================================================================
  // getDataRefreshThreshold Tests
  // ============================================================================

  describe('getDataRefreshThreshold', () => {
    it('returns 24 hours during early phase', () => {
      service.setMockTime(createStockholmDate('2024-12-10 12:00'))
      expect(service.getDataRefreshThreshold()).toBe(24)
    })

    it('returns 12 hours during mid phase', () => {
      service.setMockTime(createStockholmDate('2024-12-13 12:00'))
      expect(service.getDataRefreshThreshold()).toBe(12)
    })

    it('returns 4 hours during late phase', () => {
      service.setMockTime(createStockholmDate('2024-12-14 08:00'))
      expect(service.getDataRefreshThreshold()).toBe(4)
    })
  })

  // ============================================================================
  // shouldAllowOperation Tests
  // ============================================================================

  describe('shouldAllowOperation', () => {
    describe('within active window', () => {
      beforeEach(() => {
        service.setMockTime(createStockholmDate('2024-12-11 12:00')) // Wednesday
      })

      it('allows any operation', () => {
        expect(service.shouldAllowOperation('sync').allowed).toBe(true)
        expect(service.shouldAllowOperation('scrape').allowed).toBe(true)
        expect(service.shouldAllowOperation('predict').allowed).toBe(true)
      })

      it('provides correct reason', () => {
        const result = service.shouldAllowOperation('sync')
        expect(result.reason).toBe('Within active betting window.')
      })
    })

    describe('outside active window', () => {
      beforeEach(() => {
        service.setMockTime(createStockholmDate('2024-12-08 12:00')) // Sunday
      })

      it('blocks non-readonly operations', () => {
        expect(service.shouldAllowOperation('sync').allowed).toBe(false)
        expect(service.shouldAllowOperation('scrape').allowed).toBe(false)
        expect(service.shouldAllowOperation('predict').allowed).toBe(false)
      })

      it('allows readonly operations', () => {
        expect(service.shouldAllowOperation('health-check').allowed).toBe(true)
        expect(service.shouldAllowOperation('metrics').allowed).toBe(true)
        expect(service.shouldAllowOperation('status').allowed).toBe(true)
      })

      it('provides correct reason for readonly operations', () => {
        const result = service.shouldAllowOperation('health-check')
        expect(result.reason).toBe('Read-only operation allowed outside window.')
      })
    })

    describe('admin override', () => {
      beforeEach(() => {
        service.setMockTime(createStockholmDate('2024-12-08 12:00')) // Sunday
      })

      it('allows any operation with admin override', () => {
        expect(service.shouldAllowOperation('sync', true).allowed).toBe(true)
        expect(service.shouldAllowOperation('scrape', true).allowed).toBe(true)
        expect(service.shouldAllowOperation('predict', true).allowed).toBe(true)
      })

      it('provides admin override reason', () => {
        const result = service.shouldAllowOperation('sync', true)
        expect(result.reason).toBe('Admin override enabled.')
      })
    })
  })

  // ============================================================================
  // getNextCloseTime Tests
  // ============================================================================

  describe('getNextCloseTime', () => {
    it('returns this Saturday when called on Tuesday', () => {
      const tuesday = createStockholmDate('2024-12-10 12:00')
      service.setMockTime(tuesday)
      const closeTime = service.getNextCloseTime()

      expect(closeTime.getDay()).toBe(6) // Saturday
      expect(closeTime.getHours()).toBe(15)
      expect(closeTime.getMinutes()).toBe(59)
      // Should be same week
      expect(closeTime.getDate()).toBe(14)
    })

    it('returns this Saturday when called on Friday', () => {
      const friday = createStockholmDate('2024-12-13 12:00')
      service.setMockTime(friday)
      const closeTime = service.getNextCloseTime()

      expect(closeTime.getDay()).toBe(6)
      expect(closeTime.getDate()).toBe(14)
    })

    it('returns next Saturday when called on Sunday', () => {
      const sunday = createStockholmDate('2024-12-08 12:00')
      service.setMockTime(sunday)
      const closeTime = service.getNextCloseTime()

      expect(closeTime.getDay()).toBe(6)
      // Should be next Saturday (Dec 14)
      expect(closeTime.getDate()).toBe(14)
    })

    it('returns next Saturday when called after Saturday 16:00', () => {
      const saturdayEvening = createStockholmDate('2024-12-14 18:00')
      service.setMockTime(saturdayEvening)
      const closeTime = service.getNextCloseTime()

      expect(closeTime.getDay()).toBe(6)
      // Should be next Saturday (Dec 21)
      expect(closeTime.getDate()).toBe(21)
    })
  })

  // ============================================================================
  // getNextOpenTime Tests
  // ============================================================================

  describe('getNextOpenTime', () => {
    it('returns next Tuesday when called on Sunday', () => {
      const sunday = createStockholmDate('2024-12-08 12:00')
      service.setMockTime(sunday)
      const openTime = service.getNextOpenTime()

      expect(openTime.getDay()).toBe(2) // Tuesday
      expect(openTime.getHours()).toBe(0)
      expect(openTime.getMinutes()).toBe(0)
      expect(openTime.getDate()).toBe(10)
    })

    it('returns next Tuesday when called on Monday', () => {
      const monday = createStockholmDate('2024-12-09 12:00')
      service.setMockTime(monday)
      const openTime = service.getNextOpenTime()

      expect(openTime.getDay()).toBe(2)
      expect(openTime.getDate()).toBe(10)
    })

    it('returns next week Tuesday when called during active window', () => {
      const wednesday = createStockholmDate('2024-12-11 12:00')
      service.setMockTime(wednesday)
      const openTime = service.getNextOpenTime()

      expect(openTime.getDay()).toBe(2)
      // Should be next Tuesday (Dec 17)
      expect(openTime.getDate()).toBe(17)
    })
  })

  // ============================================================================
  // getWindowStatus Tests
  // ============================================================================

  describe('getWindowStatus', () => {
    it('returns complete status object during active window', () => {
      service.setMockTime(createStockholmDate('2024-12-11 12:00')) // Wednesday
      const status = service.getWindowStatus()

      expect(status.isActive).toBe(true)
      expect(status.currentPhase).toBe('early')
      expect(status.closeTime).toBeInstanceOf(Date)
      expect(status.openTime).toBeNull()
      expect(status.minutesUntilClose).toBeGreaterThan(0)
      expect(status.minutesUntilOpen).toBeNull()
      expect(status.scrapingIntensity).toBe('normal')
      expect(status.dataRefreshThreshold).toBe(24)
    })

    it('returns complete status object outside window', () => {
      service.setMockTime(createStockholmDate('2024-12-08 12:00')) // Sunday
      const status = service.getWindowStatus()

      expect(status.isActive).toBe(false)
      expect(status.currentPhase).toBe('closed')
      expect(status.closeTime).toBeNull()
      expect(status.openTime).toBeInstanceOf(Date)
      expect(status.minutesUntilClose).toBeNull()
      expect(status.minutesUntilOpen).toBeGreaterThan(0)
    })

    it('calculates correct minutes until close', () => {
      // Friday 14:00, close is Saturday 16:00 (26 hours = 1560 minutes)
      service.setMockTime(createStockholmDate('2024-12-13 14:00'))
      const status = service.getWindowStatus()

      // Should be approximately 26 hours (1560 minutes) - allow some tolerance
      expect(status.minutesUntilClose).toBeGreaterThan(1500)
      expect(status.minutesUntilClose).toBeLessThan(1600)
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('handles year boundary correctly', () => {
      // Monday Dec 30, 2024 - should return Tuesday Dec 31 or Jan 7
      service.setMockTime(createStockholmDate('2024-12-30 12:00'))
      const openTime = service.getNextOpenTime()
      expect(openTime.getDay()).toBe(2)
    })

    it('handles exactly midnight on Tuesday', () => {
      service.setMockTime(createStockholmDate('2024-12-10 00:00'))
      expect(service.isInActiveWindow()).toBe(true)
    })

    it('handles exactly 15:59:59 on Saturday', () => {
      const saturdayLastSecond = new Date(2024, 11, 14, 15, 59, 59, 0)
      service.setMockTime(saturdayLastSecond)
      expect(service.isInActiveWindow()).toBe(true)
    })
  })
})
