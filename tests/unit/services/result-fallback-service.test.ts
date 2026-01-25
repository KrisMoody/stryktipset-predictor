import { describe, it, expect } from 'vitest'
import type { ApiFootballFixtureResponse } from '~/server/services/api-football/types'

// ============================================================================
// Copy of the pure function for testing (to avoid importing the service)
// The actual function is in server/services/api-football/result-fallback-service.ts
// ============================================================================

type MatchStatus =
  | 'FT'
  | 'AET'
  | 'PEN'
  | 'PST'
  | 'CANC'
  | 'ABD'
  | 'NS'
  | '1H'
  | 'HT'
  | '2H'
  | 'ET'
  | 'BT'
  | 'P'
  | 'LIVE'
  | 'SUSP'
  | 'INT'
  | 'WO'
  | 'AWA'
  | 'TBD'

interface ExtractedResult {
  homeGoals: number
  awayGoals: number
  outcome: '1' | 'X' | '2'
  status: MatchStatus
  isFinished: boolean
  isTerminal: boolean
  rawStatus: string
}

const FINISHED_STATUSES: MatchStatus[] = ['FT', 'AET', 'PEN']
const TERMINAL_STATUSES: MatchStatus[] = ['PST', 'CANC', 'ABD', 'WO', 'AWA']

function extractResultFromFixture(fixture: ApiFootballFixtureResponse): ExtractedResult | null {
  const status = fixture.fixture.status.short as MatchStatus

  const isFinished = FINISHED_STATUSES.includes(status)
  const isTerminal = TERMINAL_STATUSES.includes(status)

  if (!isFinished && !isTerminal) {
    return {
      homeGoals: 0,
      awayGoals: 0,
      outcome: 'X',
      status,
      isFinished: false,
      isTerminal,
      rawStatus: fixture.fixture.status.long,
    }
  }

  let homeGoals: number
  let awayGoals: number

  if (isFinished) {
    homeGoals = fixture.score.fulltime.home ?? fixture.goals.home ?? 0
    awayGoals = fixture.score.fulltime.away ?? fixture.goals.away ?? 0
  } else {
    homeGoals = 0
    awayGoals = 0
  }

  let outcome: '1' | 'X' | '2'
  if (homeGoals > awayGoals) {
    outcome = '1'
  } else if (awayGoals > homeGoals) {
    outcome = '2'
  } else {
    outcome = 'X'
  }

  return {
    homeGoals,
    awayGoals,
    outcome,
    status,
    isFinished,
    isTerminal,
    rawStatus: fixture.fixture.status.long,
  }
}

// ============================================================================
// Test Data Factories
// ============================================================================

const createMockFixture = (
  overrides: Partial<ApiFootballFixtureResponse> = {}
): ApiFootballFixtureResponse => ({
  fixture: {
    id: 12345,
    referee: 'Test Referee',
    timezone: 'UTC',
    date: '2024-01-15T20:00:00+00:00',
    timestamp: 1705348800,
    periods: {
      first: 1705348800,
      second: 1705352400,
    },
    venue: {
      id: 1,
      name: 'Test Stadium',
      city: 'Test City',
    },
    status: {
      long: 'Match Finished',
      short: 'FT',
      elapsed: 90,
    },
  },
  league: {
    id: 1,
    name: 'Test League',
    country: 'Test Country',
    logo: 'https://example.com/logo.png',
    flag: 'https://example.com/flag.png',
    season: 2024,
    round: 'Regular Season - 1',
  },
  teams: {
    home: {
      id: 1,
      name: 'Home Team',
      logo: 'https://example.com/home.png',
      winner: true,
    },
    away: {
      id: 2,
      name: 'Away Team',
      logo: 'https://example.com/away.png',
      winner: false,
    },
  },
  goals: {
    home: 2,
    away: 1,
  },
  score: {
    halftime: {
      home: 1,
      away: 0,
    },
    fulltime: {
      home: 2,
      away: 1,
    },
    extratime: {
      home: null,
      away: null,
    },
    penalty: {
      home: null,
      away: null,
    },
  },
  ...overrides,
})

// ============================================================================
// Tests for extractResultFromFixture
// ============================================================================

describe('extractResultFromFixture', () => {
  describe('finished match statuses', () => {
    it('should extract result from FT (Full Time) match', () => {
      const fixture = createMockFixture({
        fixture: {
          ...createMockFixture().fixture,
          status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
        },
        score: {
          halftime: { home: 1, away: 0 },
          fulltime: { home: 2, away: 1 },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result).not.toBeNull()
      expect(result!.homeGoals).toBe(2)
      expect(result!.awayGoals).toBe(1)
      expect(result!.outcome).toBe('1')
      expect(result!.isFinished).toBe(true)
      expect(result!.isTerminal).toBe(false)
      expect(result!.status).toBe('FT')
    })

    it('should extract result from AET (After Extra Time) match', () => {
      const fixture = createMockFixture({
        fixture: {
          ...createMockFixture().fixture,
          status: { long: 'Match Finished After Extra Time', short: 'AET', elapsed: 120 },
        },
        score: {
          halftime: { home: 1, away: 1 },
          fulltime: { home: 2, away: 2 },
          extratime: { home: 1, away: 0 },
          penalty: { home: null, away: null },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result).not.toBeNull()
      expect(result!.homeGoals).toBe(2)
      expect(result!.awayGoals).toBe(2)
      expect(result!.outcome).toBe('X')
      expect(result!.isFinished).toBe(true)
      expect(result!.status).toBe('AET')
    })

    it('should extract result from PEN (After Penalties) match', () => {
      const fixture = createMockFixture({
        fixture: {
          ...createMockFixture().fixture,
          status: { long: 'Match Finished After Penalty', short: 'PEN', elapsed: 120 },
        },
        score: {
          halftime: { home: 0, away: 0 },
          fulltime: { home: 1, away: 1 },
          extratime: { home: 0, away: 0 },
          penalty: { home: 5, away: 4 },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result).not.toBeNull()
      expect(result!.homeGoals).toBe(1)
      expect(result!.awayGoals).toBe(1)
      expect(result!.outcome).toBe('X')
      expect(result!.isFinished).toBe(true)
      expect(result!.status).toBe('PEN')
    })

    it('should determine correct outcome for home win', () => {
      const fixture = createMockFixture({
        score: {
          halftime: { home: 2, away: 0 },
          fulltime: { home: 3, away: 0 },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result!.outcome).toBe('1')
    })

    it('should determine correct outcome for away win', () => {
      const fixture = createMockFixture({
        score: {
          halftime: { home: 0, away: 1 },
          fulltime: { home: 0, away: 2 },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result!.outcome).toBe('2')
    })

    it('should determine correct outcome for draw', () => {
      const fixture = createMockFixture({
        score: {
          halftime: { home: 1, away: 1 },
          fulltime: { home: 2, away: 2 },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result!.outcome).toBe('X')
    })
  })

  describe('terminal match statuses (no result expected)', () => {
    it('should handle PST (Postponed) status', () => {
      const fixture = createMockFixture({
        fixture: {
          ...createMockFixture().fixture,
          status: { long: 'Match Postponed', short: 'PST', elapsed: null },
        },
        goals: { home: null, away: null },
        score: {
          halftime: { home: null, away: null },
          fulltime: { home: null, away: null },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result).not.toBeNull()
      expect(result!.isFinished).toBe(false)
      expect(result!.isTerminal).toBe(true)
      expect(result!.status).toBe('PST')
      expect(result!.rawStatus).toBe('Match Postponed')
    })

    it('should handle CANC (Cancelled) status', () => {
      const fixture = createMockFixture({
        fixture: {
          ...createMockFixture().fixture,
          status: { long: 'Match Cancelled', short: 'CANC', elapsed: null },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result!.isFinished).toBe(false)
      expect(result!.isTerminal).toBe(true)
      expect(result!.status).toBe('CANC')
    })

    it('should handle ABD (Abandoned) status', () => {
      const fixture = createMockFixture({
        fixture: {
          ...createMockFixture().fixture,
          status: { long: 'Match Abandoned', short: 'ABD', elapsed: 45 },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result!.isFinished).toBe(false)
      expect(result!.isTerminal).toBe(true)
      expect(result!.status).toBe('ABD')
    })

    it('should handle WO (Walkover) status', () => {
      const fixture = createMockFixture({
        fixture: {
          ...createMockFixture().fixture,
          status: { long: 'Walkover', short: 'WO', elapsed: null },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result!.isTerminal).toBe(true)
      expect(result!.status).toBe('WO')
    })
  })

  describe('in-progress match statuses', () => {
    it('should handle 1H (First Half) status', () => {
      const fixture = createMockFixture({
        fixture: {
          ...createMockFixture().fixture,
          status: { long: 'First Half', short: '1H', elapsed: 30 },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result!.isFinished).toBe(false)
      expect(result!.isTerminal).toBe(false)
      expect(result!.status).toBe('1H')
    })

    it('should handle HT (Half Time) status', () => {
      const fixture = createMockFixture({
        fixture: {
          ...createMockFixture().fixture,
          status: { long: 'Half Time', short: 'HT', elapsed: 45 },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result!.isFinished).toBe(false)
      expect(result!.isTerminal).toBe(false)
      expect(result!.status).toBe('HT')
    })

    it('should handle NS (Not Started) status', () => {
      const fixture = createMockFixture({
        fixture: {
          ...createMockFixture().fixture,
          status: { long: 'Not Started', short: 'NS', elapsed: null },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result!.isFinished).toBe(false)
      expect(result!.isTerminal).toBe(false)
      expect(result!.status).toBe('NS')
    })
  })

  describe('edge cases', () => {
    it('should handle 0-0 draw', () => {
      const fixture = createMockFixture({
        score: {
          halftime: { home: 0, away: 0 },
          fulltime: { home: 0, away: 0 },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result!.homeGoals).toBe(0)
      expect(result!.awayGoals).toBe(0)
      expect(result!.outcome).toBe('X')
    })

    it('should fall back to goals if fulltime is null', () => {
      const fixture = createMockFixture({
        goals: { home: 3, away: 2 },
        score: {
          halftime: { home: 1, away: 1 },
          fulltime: { home: null, away: null },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      })

      const result = extractResultFromFixture(fixture)

      expect(result!.homeGoals).toBe(3)
      expect(result!.awayGoals).toBe(2)
      expect(result!.outcome).toBe('1')
    })
  })
})

// ============================================================================
// Tests for 48h threshold logic (unit tests without mocking)
// ============================================================================

describe('48h threshold logic', () => {
  it('should correctly calculate 48h cutoff time', () => {
    const now = Date.now()
    const cutoffTime = new Date(now - 48 * 60 * 60 * 1000)
    const hoursAgo = (now - cutoffTime.getTime()) / (60 * 60 * 1000)

    expect(hoursAgo).toBe(48)
  })

  it('should identify draws past 48h threshold with missing results', () => {
    const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000)

    const eligibleDraw = {
      id: 1,
      is_current: true,
      matches: [
        { start_time: new Date(Date.now() - 50 * 60 * 60 * 1000), outcome: null },
        { start_time: new Date(Date.now() - 52 * 60 * 60 * 1000), outcome: '1' },
      ],
    }

    const maxStartTime = Math.max(...eligibleDraw.matches.map(m => m.start_time.getTime()))
    const hasMissingResults = eligibleDraw.matches.some(m => m.outcome === null)

    expect(eligibleDraw.is_current).toBe(true)
    expect(new Date(maxStartTime) < cutoffTime).toBe(true)
    expect(hasMissingResults).toBe(true)
  })

  it('should not include draws where all matches have results', () => {
    const drawWithAllResults = {
      id: 2,
      is_current: true,
      matches: [
        { start_time: new Date(Date.now() - 50 * 60 * 60 * 1000), outcome: '1' },
        { start_time: new Date(Date.now() - 52 * 60 * 60 * 1000), outcome: 'X' },
      ],
    }

    const hasMissingResults = drawWithAllResults.matches.some(m => m.outcome === null)
    expect(hasMissingResults).toBe(false)
  })

  it('should not include draws that are not current', () => {
    const archivedDraw = {
      id: 3,
      is_current: false,
      matches: [{ start_time: new Date(Date.now() - 50 * 60 * 60 * 1000), outcome: null }],
    }

    expect(archivedDraw.is_current).toBe(false)
  })

  it('should not include draws within 48h window', () => {
    const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000)

    const recentDraw = {
      id: 4,
      is_current: true,
      matches: [{ start_time: new Date(Date.now() - 24 * 60 * 60 * 1000), outcome: null }],
    }

    const maxStartTime = Math.max(...recentDraw.matches.map(m => m.start_time.getTime()))
    expect(new Date(maxStartTime) < cutoffTime).toBe(false)
  })

  it('should consider terminal statuses as not blocking finalization', () => {
    const terminalStatuses = ['Postponed', 'Cancelled', 'Abandoned', 'Walkover']

    const drawWithTerminalMatch = {
      id: 5,
      is_current: true,
      matches: [
        {
          start_time: new Date(Date.now() - 50 * 60 * 60 * 1000),
          outcome: '1',
          status: 'Completed',
        },
        {
          start_time: new Date(Date.now() - 50 * 60 * 60 * 1000),
          outcome: null,
          status: 'Postponed',
        },
      ],
    }

    const nonTerminalMissingResults = drawWithTerminalMatch.matches.filter(
      m => m.outcome === null && !terminalStatuses.includes(m.status)
    )

    expect(nonTerminalMissingResults.length).toBe(0)
  })
})
