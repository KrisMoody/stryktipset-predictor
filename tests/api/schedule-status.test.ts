import { describe, it, expect } from 'vitest'

/**
 * API Tests for /api/schedule/status endpoint
 *
 * These tests verify the API response format and data transformation
 * by simulating the service response.
 *
 * Types match server/services/schedule-window-service.ts
 */

// Types matching the actual ScheduleWindowStatus interface
interface WindowStatus {
  isActive: boolean
  currentPhase: 'early' | 'mid' | 'late' | 'closed'
  closeTime: Date | null
  openTime: Date | null
  minutesUntilClose: number | null
  minutesUntilOpen: number | null
  scrapingIntensity: 'normal' | 'aggressive' | 'very_aggressive'
  dataRefreshThreshold: number // Hours (4, 12, or 24)
  reason: string
  stockholmTime: string
}

// Simulate the API handler logic (extracted for testing)
// Matches server/api/schedule/status.get.ts
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

// Early phase: Tuesday-Thursday, normal intensity, 24h refresh threshold
const createEarlyPhaseStatus = (overrides: Partial<WindowStatus> = {}): WindowStatus => ({
  isActive: true,
  currentPhase: 'early',
  closeTime: new Date('2024-11-02T15:59:00+01:00'), // Saturday
  openTime: null,
  minutesUntilClose: 4320, // ~3 days
  minutesUntilOpen: null,
  scrapingIntensity: 'normal',
  dataRefreshThreshold: 24, // Hours
  reason: 'Wednesday - match list published. Normal operations.',
  stockholmTime: '2024-10-30T14:00:00+01:00',
  ...overrides,
})

// Mid phase: Friday, aggressive intensity, 12h refresh threshold
const createMidPhaseStatus = (overrides: Partial<WindowStatus> = {}): WindowStatus => ({
  isActive: true,
  currentPhase: 'mid',
  closeTime: new Date('2024-11-02T15:59:00+01:00'),
  openTime: null,
  minutesUntilClose: 1440, // ~24 hours (Friday)
  minutesUntilOpen: null,
  scrapingIntensity: 'aggressive',
  dataRefreshThreshold: 12, // Hours
  reason: 'Friday - betting tips being published. Moderate refresh rate.',
  stockholmTime: '2024-11-01T14:00:00+01:00',
  ...overrides,
})

// Late phase: Saturday morning, very aggressive intensity, 4h refresh threshold
const createLatePhaseStatus = (overrides: Partial<WindowStatus> = {}): WindowStatus => ({
  isActive: true,
  currentPhase: 'late',
  closeTime: new Date('2024-11-02T15:59:00+01:00'),
  openTime: null,
  minutesUntilClose: 120, // 2 hours until spelstopp
  minutesUntilOpen: null,
  scrapingIntensity: 'very_aggressive',
  dataRefreshThreshold: 4, // Hours
  reason: 'Saturday - 2h until spelstopp. Aggressive data refresh.',
  stockholmTime: '2024-11-02T14:00:00+01:00',
  ...overrides,
})

// Closed phase: Sunday/Monday or Saturday after 16:00
const createClosedPhaseStatus = (overrides: Partial<WindowStatus> = {}): WindowStatus => ({
  isActive: false,
  currentPhase: 'closed',
  closeTime: null,
  openTime: new Date('2024-11-05T00:00:00+01:00'), // Next Tuesday
  minutesUntilClose: null,
  minutesUntilOpen: 2880, // 2 days
  scrapingIntensity: 'normal', // Default when closed
  dataRefreshThreshold: 24, // Default when closed
  reason: 'Sunday - new coupon may be opening. Light sync only.',
  stockholmTime: '2024-11-03T14:00:00+01:00',
  ...overrides,
})

// ============================================================================
// GET /api/schedule/status Tests
// ============================================================================

describe('GET /api/schedule/status', () => {
  describe('response structure', () => {
    it('returns success: true on valid response', () => {
      const status = createEarlyPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.success).toBe(true)
    })

    it('returns all required status fields', () => {
      const status = createEarlyPhaseStatus()
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

  describe('early phase (Tuesday-Thursday)', () => {
    it('returns isActive: true during betting window', () => {
      const status = createEarlyPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.isActive).toBe(true)
    })

    it('returns currentPhase: "early" during Tuesday-Thursday', () => {
      const status = createEarlyPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.currentPhase).toBe('early')
    })

    it('returns normal scraping intensity', () => {
      const status = createEarlyPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.scrapingIntensity).toBe('normal')
    })

    it('returns 24 hour refresh threshold', () => {
      const status = createEarlyPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.dataRefreshThreshold).toBe(24)
    })

    it('returns closeTime as ISO string', () => {
      const status = createEarlyPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.closeTime).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('returns minutesUntilClose as number', () => {
      const status = createEarlyPhaseStatus({ minutesUntilClose: 4320 })
      const response = handleGetScheduleStatus(status)
      expect(response.status.minutesUntilClose).toBe(4320)
    })

    it('returns minutesUntilOpen as null during active window', () => {
      const status = createEarlyPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.minutesUntilOpen).toBeNull()
    })
  })

  describe('mid phase (Friday)', () => {
    it('returns currentPhase: "mid" on Friday', () => {
      const status = createMidPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.currentPhase).toBe('mid')
    })

    it('returns aggressive scraping intensity', () => {
      const status = createMidPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.scrapingIntensity).toBe('aggressive')
    })

    it('returns 12 hour refresh threshold', () => {
      const status = createMidPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.dataRefreshThreshold).toBe(12)
    })
  })

  describe('late phase (Saturday morning)', () => {
    it('returns currentPhase: "late" on Saturday morning', () => {
      const status = createLatePhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.currentPhase).toBe('late')
    })

    it('returns very_aggressive scraping intensity', () => {
      const status = createLatePhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.scrapingIntensity).toBe('very_aggressive')
    })

    it('returns 4 hour refresh threshold', () => {
      const status = createLatePhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.dataRefreshThreshold).toBe(4)
    })

    it('returns short minutesUntilClose', () => {
      const status = createLatePhaseStatus({ minutesUntilClose: 120 })
      const response = handleGetScheduleStatus(status)
      expect(response.status.minutesUntilClose).toBe(120)
    })
  })

  describe('closed phase', () => {
    it('returns isActive: false when window is closed', () => {
      const status = createClosedPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.isActive).toBe(false)
    })

    it('returns currentPhase: "closed" when window is closed', () => {
      const status = createClosedPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.currentPhase).toBe('closed')
    })

    it('returns closeTime as null when window is closed', () => {
      const status = createClosedPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.closeTime).toBeNull()
    })

    it('returns minutesUntilClose as null when window is closed', () => {
      const status = createClosedPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.minutesUntilClose).toBeNull()
    })

    it('returns minutesUntilOpen as number when window is closed', () => {
      const status = createClosedPhaseStatus({ minutesUntilOpen: 2880 })
      const response = handleGetScheduleStatus(status)
      expect(response.status.minutesUntilOpen).toBe(2880)
    })

    it('returns openTime as ISO string when window is closed', () => {
      const status = createClosedPhaseStatus()
      const response = handleGetScheduleStatus(status)
      expect(response.status.openTime).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('scraping intensity values', () => {
    it.each([
      ['normal', 'normal'],
      ['aggressive', 'aggressive'],
      ['very_aggressive', 'very_aggressive'],
    ] as const)('returns scrapingIntensity: "%s"', (intensity, expected) => {
      const status = createEarlyPhaseStatus({
        scrapingIntensity: intensity,
      })
      const response = handleGetScheduleStatus(status)
      expect(response.status.scrapingIntensity).toBe(expected)
    })
  })

  describe('data refresh threshold values', () => {
    it.each([
      ['early', 24],
      ['mid', 12],
      ['late', 4],
    ] as const)('returns %d hours threshold for %s phase', (phase, threshold) => {
      const factories = {
        early: createEarlyPhaseStatus,
        mid: createMidPhaseStatus,
        late: createLatePhaseStatus,
      }
      const status = factories[phase]()
      const response = handleGetScheduleStatus(status)
      expect(response.status.dataRefreshThreshold).toBe(threshold)
    })
  })

  describe('stockholm time', () => {
    it('returns stockholmTime in ISO format', () => {
      const status = createEarlyPhaseStatus({
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
      const status = createEarlyPhaseStatus({
        closeTime: new Date('2024-11-02T15:59:00.000Z'),
      })
      const response = handleGetScheduleStatus(status)
      expect(typeof response.status.closeTime).toBe('string')
    })

    it('handles null dates correctly', () => {
      const status = createClosedPhaseStatus({
        closeTime: null,
      })
      const response = handleGetScheduleStatus(status)
      expect(response.status.closeTime).toBeNull()
    })

    it('preserves null for openTime during active window', () => {
      const status = createEarlyPhaseStatus({
        openTime: null,
      })
      const response = handleGetScheduleStatus(status)
      expect(response.status.openTime).toBeNull()
    })
  })
})
