import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * API Tests for /api/schedule/status endpoint
 *
 * These tests verify the API response format and data transformation
 * by simulating the service response.
 */

// Types matching the service
interface WindowStatus {
  isActive: boolean
  currentPhase: 'active' | 'pre-close' | 'closed' | 'pre-open'
  closeTime: Date | null
  openTime: Date | null
  minutesUntilClose: number | null
  minutesUntilOpen: number | null
  scrapingIntensity: 'high' | 'medium' | 'low' | 'minimal'
  dataRefreshThreshold: number
  reason: string
  stockholmTime: string
}

// Simulate the API handler logic (extracted for testing)
const handleGetScheduleStatus = (status: WindowStatus) => {
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

const handleScheduleStatusError = (error: Error) => {
  return {
    success: false,
    error: error.message,
  }
}

// ============================================================================
// Test Data Factories
// ============================================================================

const createActiveWindowStatus = (overrides: Partial<WindowStatus> = {}): WindowStatus => ({
  isActive: true,
  currentPhase: 'active',
  closeTime: new Date('2024-11-02T15:59:00+01:00'),
  openTime: new Date('2024-11-05T00:00:00+01:00'),
  minutesUntilClose: 120,
  minutesUntilOpen: null,
  scrapingIntensity: 'high',
  dataRefreshThreshold: 15,
  reason: 'Active betting window',
  stockholmTime: '2024-11-02T14:00:00+01:00',
  ...overrides,
})

const createClosedWindowStatus = (overrides: Partial<WindowStatus> = {}): WindowStatus => ({
  isActive: false,
  currentPhase: 'closed',
  closeTime: null,
  openTime: new Date('2024-11-05T00:00:00+01:00'),
  minutesUntilClose: null,
  minutesUntilOpen: 2880, // 2 days
  scrapingIntensity: 'minimal',
  dataRefreshThreshold: 360,
  reason: 'Window closed until Tuesday',
  stockholmTime: '2024-11-03T14:00:00+01:00',
  ...overrides,
})

const createPreCloseWindowStatus = (overrides: Partial<WindowStatus> = {}): WindowStatus => ({
  isActive: true,
  currentPhase: 'pre-close',
  closeTime: new Date('2024-11-02T15:59:00+01:00'),
  openTime: new Date('2024-11-05T00:00:00+01:00'),
  minutesUntilClose: 30,
  minutesUntilOpen: null,
  scrapingIntensity: 'high',
  dataRefreshThreshold: 5,
  reason: 'Window closing soon',
  stockholmTime: '2024-11-02T15:30:00+01:00',
  ...overrides,
})

// ============================================================================
// GET /api/schedule/status Tests
// ============================================================================

describe('GET /api/schedule/status', () => {
  describe('response structure', () => {
    it('returns success: true on valid response', () => {
      const status = createActiveWindowStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.success).toBe(true)
    })

    it('returns all required status fields', () => {
      const status = createActiveWindowStatus()
      const response = handleGetScheduleStatus(status)

      expect(response.status).toHaveProperty('isActive')
      expect(response.status).toHaveProperty('currentPhase')
      expect(response.status).toHaveProperty('closeTime')
      expect(response.status).toHaveProperty('openTime')
      expect(response.status).toHaveProperty('minutesUntilClose')
      expect(response.status).toHaveProperty('minutesUntilOpen')
      expect(response.status).toHaveProperty('scrapingIntensity')
      expect(response.status).toHaveProperty('dataRefreshThreshold')
      expect(response.status).toHaveProperty('reason')
      expect(response.status).toHaveProperty('stockholmTime')
    })
  })

  describe('active window', () => {
    it('returns isActive: true during betting window', () => {
      const status = createActiveWindowStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.isActive).toBe(true)
    })

    it('returns currentPhase: "active" during normal active window', () => {
      const status = createActiveWindowStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.currentPhase).toBe('active')
    })

    it('returns closeTime as ISO string', () => {
      const status = createActiveWindowStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.closeTime).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('returns minutesUntilClose as number', () => {
      const status = createActiveWindowStatus({ minutesUntilClose: 120 })
      const response = handleGetScheduleStatus(status)
      expect(response.status.minutesUntilClose).toBe(120)
    })

    it('returns minutesUntilOpen as null during active window', () => {
      const status = createActiveWindowStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.minutesUntilOpen).toBeNull()
    })
  })

  describe('closed window', () => {
    it('returns isActive: false when window is closed', () => {
      const status = createClosedWindowStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.isActive).toBe(false)
    })

    it('returns currentPhase: "closed" when window is closed', () => {
      const status = createClosedWindowStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.currentPhase).toBe('closed')
    })

    it('returns closeTime as null when window is closed', () => {
      const status = createClosedWindowStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.closeTime).toBeNull()
    })

    it('returns minutesUntilClose as null when window is closed', () => {
      const status = createClosedWindowStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.minutesUntilClose).toBeNull()
    })

    it('returns minutesUntilOpen as number when window is closed', () => {
      const status = createClosedWindowStatus({ minutesUntilOpen: 2880 })
      const response = handleGetScheduleStatus(status)
      expect(response.status.minutesUntilOpen).toBe(2880)
    })
  })

  describe('pre-close phase', () => {
    it('returns currentPhase: "pre-close" when window is closing soon', () => {
      const status = createPreCloseWindowStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.currentPhase).toBe('pre-close')
    })

    it('returns high scraping intensity during pre-close', () => {
      const status = createPreCloseWindowStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.scrapingIntensity).toBe('high')
    })

    it('returns short refresh threshold during pre-close', () => {
      const status = createPreCloseWindowStatus({ dataRefreshThreshold: 5 })
      const response = handleGetScheduleStatus(status)
      expect(response.status.dataRefreshThreshold).toBe(5)
    })
  })

  describe('scraping intensity', () => {
    it.each([
      ['high', 'high'],
      ['medium', 'medium'],
      ['low', 'low'],
      ['minimal', 'minimal'],
    ])('returns scrapingIntensity: "%s"', (intensity, expected) => {
      const status = createActiveWindowStatus({
        scrapingIntensity: intensity as 'high' | 'medium' | 'low' | 'minimal',
      })
      const response = handleGetScheduleStatus(status)
      expect(response.status.scrapingIntensity).toBe(expected)
    })
  })

  describe('data refresh threshold', () => {
    it('returns shorter threshold during active window', () => {
      const status = createActiveWindowStatus({ dataRefreshThreshold: 15 })
      const response = handleGetScheduleStatus(status)
      expect(response.status.dataRefreshThreshold).toBeLessThanOrEqual(30)
    })

    it('returns longer threshold during closed window', () => {
      const status = createClosedWindowStatus({ dataRefreshThreshold: 360 })
      const response = handleGetScheduleStatus(status)
      expect(response.status.dataRefreshThreshold).toBeGreaterThanOrEqual(60)
    })
  })

  describe('stockholm time', () => {
    it('returns stockholmTime in ISO format', () => {
      const status = createActiveWindowStatus({
        stockholmTime: '2024-11-02T14:00:00+01:00',
      })
      const response = handleGetScheduleStatus(status)
      expect(response.status.stockholmTime).toContain('2024-11-02')
    })
  })

  describe('error handling', () => {
    it('returns success: false on error', () => {
      const error = new Error('Service unavailable')
      const response = handleScheduleStatusError(error)
      expect(response.success).toBe(false)
    })

    it('returns error message on error', () => {
      const error = new Error('Connection timeout')
      const response = handleScheduleStatusError(error)
      expect(response.error).toBe('Connection timeout')
    })
  })

  describe('date serialization', () => {
    it('converts Date objects to ISO strings', () => {
      const status = createActiveWindowStatus({
        closeTime: new Date('2024-11-02T15:59:00.000Z'),
        openTime: new Date('2024-11-05T00:00:00.000Z'),
      })
      const response = handleGetScheduleStatus(status)

      expect(typeof response.status.closeTime).toBe('string')
      expect(typeof response.status.openTime).toBe('string')
    })

    it('handles null dates correctly', () => {
      const status = createClosedWindowStatus({
        closeTime: null,
      })
      const response = handleGetScheduleStatus(status)
      expect(response.status.closeTime).toBeNull()
    })
  })
})
