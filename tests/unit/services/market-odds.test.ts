/* eslint-disable @typescript-eslint/no-explicit-any -- Test file with mock data */
import { describe, it, expect, vi } from 'vitest'

// Mock the console methods to avoid noisy output
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

// ============================================================================
// Test Utilities - Extracted calculateMarketConsensus logic for testing
// ============================================================================

/**
 * Calculate market consensus from multiple bookmaker probabilities.
 * Uses equal-margin method to remove bookmaker margin and get fair probabilities.
 * This is a direct copy of the logic from MatchEnrichmentService for testing.
 */
function calculateMarketConsensus(probabilities: { home: number; draw: number; away: number }[]): {
  fairProbabilities: { home: number; draw: number; away: number }
  fairOdds: { home: number; draw: number; away: number }
  averageMargin: number
  standardDeviation: { home: number; draw: number; away: number }
} {
  const n = probabilities.length

  // Calculate average implied probabilities
  const avgHome = probabilities.reduce((sum, p) => sum + p.home, 0) / n
  const avgDraw = probabilities.reduce((sum, p) => sum + p.draw, 0) / n
  const avgAway = probabilities.reduce((sum, p) => sum + p.away, 0) / n

  // Calculate total (includes margin) - typically >100%
  const totalImplied = avgHome + avgDraw + avgAway
  const averageMargin = totalImplied - 100

  // Remove margin using equal-margin method (divide by total and multiply by 100)
  const fairHome = (avgHome / totalImplied) * 100
  const fairDraw = (avgDraw / totalImplied) * 100
  const fairAway = (avgAway / totalImplied) * 100

  // Calculate fair odds from fair probabilities
  const fairOddsHome = fairHome > 0 ? 100 / fairHome : 0
  const fairOddsDraw = fairDraw > 0 ? 100 / fairDraw : 0
  const fairOddsAway = fairAway > 0 ? 100 / fairAway : 0

  // Calculate standard deviation (measure of market disagreement)
  const stdHome = Math.sqrt(
    probabilities.reduce((sum, p) => sum + Math.pow(p.home - avgHome, 2), 0) / n
  )
  const stdDraw = Math.sqrt(
    probabilities.reduce((sum, p) => sum + Math.pow(p.draw - avgDraw, 2), 0) / n
  )
  const stdAway = Math.sqrt(
    probabilities.reduce((sum, p) => sum + Math.pow(p.away - avgAway, 2), 0) / n
  )

  return {
    fairProbabilities: {
      home: Math.round(fairHome * 100) / 100,
      draw: Math.round(fairDraw * 100) / 100,
      away: Math.round(fairAway * 100) / 100,
    },
    fairOdds: {
      home: Math.round(fairOddsHome * 100) / 100,
      draw: Math.round(fairOddsDraw * 100) / 100,
      away: Math.round(fairOddsAway * 100) / 100,
    },
    averageMargin: Math.round(averageMargin * 100) / 100,
    standardDeviation: {
      home: Math.round(stdHome * 100) / 100,
      draw: Math.round(stdDraw * 100) / 100,
      away: Math.round(stdAway * 100) / 100,
    },
  }
}

/**
 * Filter bookmakers to target list
 * Replicates the filtering logic from MatchEnrichmentService
 */
const TARGET_BOOKMAKERS = ['Pinnacle', 'Bet365', 'Unibet', '1xBet', 'Betfair']

function filterToTargetBookmakers(
  bookmakers: Array<{ id: number; name: string; bets: any[] }>
): Array<{ id: number; name: string; bets: any[] }> {
  return bookmakers.filter(bm =>
    TARGET_BOOKMAKERS.some(target => bm.name.toLowerCase().includes(target.toLowerCase()))
  )
}

/**
 * Parse odds from API-Football response
 */
function parseBookmakerOdds(bookmaker: {
  name: string
  bets: Array<{ id: number; name: string; values: Array<{ value: string; odd: string }> }>
}): { home: number; draw: number; away: number } | null {
  const matchWinnerBet = bookmaker.bets.find(bet => bet.id === 1 || bet.name === 'Match Winner')
  if (!matchWinnerBet) return null

  const homeValue = matchWinnerBet.values.find(v => v.value === 'Home')
  const drawValue = matchWinnerBet.values.find(v => v.value === 'Draw')
  const awayValue = matchWinnerBet.values.find(v => v.value === 'Away')

  if (!homeValue || !drawValue || !awayValue) return null

  const homeOdds = parseFloat(homeValue.odd)
  const drawOdds = parseFloat(drawValue.odd)
  const awayOdds = parseFloat(awayValue.odd)

  if (isNaN(homeOdds) || isNaN(drawOdds) || isNaN(awayOdds)) return null

  // Calculate implied probabilities
  const impliedHome = (1 / homeOdds) * 100
  const impliedDraw = (1 / drawOdds) * 100
  const impliedAway = (1 / awayOdds) * 100

  return { home: impliedHome, draw: impliedDraw, away: impliedAway }
}

// ============================================================================
// Market Consensus Calculation Tests
// ============================================================================

describe('Market Odds - calculateMarketConsensus', () => {
  describe('average probability calculation', () => {
    it('calculates average probabilities from multiple bookmakers', () => {
      const probabilities = [
        { home: 40, draw: 30, away: 35 }, // 105% total
        { home: 42, draw: 28, away: 35 }, // 105% total
      ]

      const result = calculateMarketConsensus(probabilities)

      // Average: home=41, draw=29, away=35, total=105
      // Fair: home=41/105*100=39.05, draw=29/105*100=27.62, away=35/105*100=33.33
      expect(result.fairProbabilities.home).toBeCloseTo(39.05, 1)
      expect(result.fairProbabilities.draw).toBeCloseTo(27.62, 1)
      expect(result.fairProbabilities.away).toBeCloseTo(33.33, 1)
    })

    it('handles single bookmaker', () => {
      const probabilities = [{ home: 45, draw: 28, away: 32 }] // 105% total

      const result = calculateMarketConsensus(probabilities)

      // Fair: home=45/105*100=42.86, draw=28/105*100=26.67, away=32/105*100=30.48
      expect(result.fairProbabilities.home).toBeCloseTo(42.86, 1)
      expect(result.fairProbabilities.draw).toBeCloseTo(26.67, 1)
      expect(result.fairProbabilities.away).toBeCloseTo(30.48, 1)
    })

    it('handles five bookmakers', () => {
      const probabilities = [
        { home: 40, draw: 30, away: 35 },
        { home: 42, draw: 28, away: 35 },
        { home: 41, draw: 29, away: 35 },
        { home: 43, draw: 27, away: 35 },
        { home: 39, draw: 31, away: 35 },
      ]

      const result = calculateMarketConsensus(probabilities)

      // Average: home=41, draw=29, away=35
      expect(result.fairProbabilities).toBeDefined()
      // Fair probabilities should sum to 100
      const sum =
        result.fairProbabilities.home +
        result.fairProbabilities.draw +
        result.fairProbabilities.away
      expect(sum).toBeCloseTo(100, 0)
    })
  })

  describe('margin removal', () => {
    it('removes margin using equal-margin method', () => {
      // Bookmaker with 5% margin (total implied = 105%)
      const probabilities = [{ home: 42, draw: 28, away: 35 }]

      const result = calculateMarketConsensus(probabilities)

      // After margin removal, probabilities should sum to 100
      const sum =
        result.fairProbabilities.home +
        result.fairProbabilities.draw +
        result.fairProbabilities.away
      expect(sum).toBeCloseTo(100, 1)
    })

    it('correctly calculates average margin', () => {
      const probabilities = [
        { home: 42, draw: 28, away: 35 }, // 105% total
        { home: 43, draw: 29, away: 34 }, // 106% total
      ]

      const result = calculateMarketConsensus(probabilities)

      // Average margin = (105+106)/2 - 100 = 5.5%
      expect(result.averageMargin).toBeCloseTo(5.5, 1)
    })

    it('handles zero margin (no margin bookmaker)', () => {
      // Perfect odds with no margin (total = 100%)
      const probabilities = [{ home: 40, draw: 30, away: 30 }]

      const result = calculateMarketConsensus(probabilities)

      expect(result.averageMargin).toBeCloseTo(0, 1)
      expect(result.fairProbabilities.home).toBeCloseTo(40, 1)
      expect(result.fairProbabilities.draw).toBeCloseTo(30, 1)
      expect(result.fairProbabilities.away).toBeCloseTo(30, 1)
    })

    it('handles high margin bookmaker', () => {
      // High margin bookmaker (total = 115%)
      const probabilities = [{ home: 46, draw: 34, away: 35 }]

      const result = calculateMarketConsensus(probabilities)

      expect(result.averageMargin).toBeCloseTo(15, 1)
      // Fair probabilities should still sum to 100
      const sum =
        result.fairProbabilities.home +
        result.fairProbabilities.draw +
        result.fairProbabilities.away
      expect(sum).toBeCloseTo(100, 1)
    })
  })

  describe('fair odds calculation', () => {
    it('calculates fair odds from fair probabilities', () => {
      // ~40% home, ~30% draw, ~30% away after margin removal
      const probabilities = [{ home: 42, draw: 31.5, away: 31.5 }]

      const result = calculateMarketConsensus(probabilities)

      // Fair odds = 100 / fair probability
      expect(result.fairOdds.home).toBeCloseTo(100 / result.fairProbabilities.home, 1)
      expect(result.fairOdds.draw).toBeCloseTo(100 / result.fairProbabilities.draw, 1)
      expect(result.fairOdds.away).toBeCloseTo(100 / result.fairProbabilities.away, 1)
    })

    it('produces consistent odds/probability relationship', () => {
      const probabilities = [
        { home: 55, draw: 25, away: 25 }, // Heavy favorite
      ]

      const result = calculateMarketConsensus(probabilities)

      // Lower probability should give higher odds
      expect(result.fairOdds.home).toBeLessThan(result.fairOdds.draw)
      expect(result.fairOdds.home).toBeLessThan(result.fairOdds.away)
    })
  })

  describe('standard deviation calculation', () => {
    it('calculates zero standard deviation when all bookmakers agree', () => {
      const probabilities = [
        { home: 40, draw: 30, away: 35 },
        { home: 40, draw: 30, away: 35 },
        { home: 40, draw: 30, away: 35 },
      ]

      const result = calculateMarketConsensus(probabilities)

      expect(result.standardDeviation.home).toBe(0)
      expect(result.standardDeviation.draw).toBe(0)
      expect(result.standardDeviation.away).toBe(0)
    })

    it('calculates positive standard deviation when bookmakers disagree', () => {
      const probabilities = [
        { home: 35, draw: 30, away: 40 }, // Away favorite
        { home: 45, draw: 30, away: 30 }, // Home favorite
      ]

      const result = calculateMarketConsensus(probabilities)

      expect(result.standardDeviation.home).toBeGreaterThan(0)
      expect(result.standardDeviation.away).toBeGreaterThan(0)
      // Draw is same in both, so std dev = 0
      expect(result.standardDeviation.draw).toBe(0)
    })

    it('calculates higher standard deviation with more disagreement', () => {
      const lowDisagreement = [
        { home: 40, draw: 30, away: 35 },
        { home: 42, draw: 30, away: 33 },
      ]

      const highDisagreement = [
        { home: 35, draw: 30, away: 40 },
        { home: 50, draw: 30, away: 25 },
      ]

      const lowResult = calculateMarketConsensus(lowDisagreement)
      const highResult = calculateMarketConsensus(highDisagreement)

      expect(highResult.standardDeviation.home).toBeGreaterThan(lowResult.standardDeviation.home)
      expect(highResult.standardDeviation.away).toBeGreaterThan(lowResult.standardDeviation.away)
    })
  })
})

// ============================================================================
// Bookmaker Filtering Tests
// ============================================================================

describe('Market Odds - Bookmaker Filtering', () => {
  describe('filterToTargetBookmakers', () => {
    it('filters to only target bookmakers', () => {
      const bookmakers = [
        { id: 1, name: 'Pinnacle', bets: [] },
        { id: 2, name: 'Bet365', bets: [] },
        { id: 3, name: 'Random Bookmaker', bets: [] },
        { id: 4, name: 'Unibet', bets: [] },
        { id: 5, name: '1xBet', bets: [] },
        { id: 6, name: 'Another One', bets: [] },
        { id: 7, name: 'Betfair', bets: [] },
      ]

      const filtered = filterToTargetBookmakers(bookmakers)

      expect(filtered.length).toBe(5)
      expect(filtered.map(b => b.name)).toEqual([
        'Pinnacle',
        'Bet365',
        'Unibet',
        '1xBet',
        'Betfair',
      ])
    })

    it('handles case-insensitive matching', () => {
      const bookmakers = [
        { id: 1, name: 'PINNACLE', bets: [] },
        { id: 2, name: 'bet365', bets: [] },
        { id: 3, name: 'UnIbEt', bets: [] },
      ]

      const filtered = filterToTargetBookmakers(bookmakers)

      expect(filtered.length).toBe(3)
    })

    it('handles partial name matching', () => {
      const bookmakers = [
        { id: 1, name: 'Pinnacle Sports', bets: [] },
        { id: 2, name: 'Bet365 UK', bets: [] },
      ]

      const filtered = filterToTargetBookmakers(bookmakers)

      expect(filtered.length).toBe(2)
    })

    it('returns empty array when no target bookmakers found', () => {
      const bookmakers = [
        { id: 1, name: 'Local Bookie', bets: [] },
        { id: 2, name: 'Unknown Book', bets: [] },
      ]

      const filtered = filterToTargetBookmakers(bookmakers)

      expect(filtered.length).toBe(0)
    })

    it('handles empty bookmakers array', () => {
      const filtered = filterToTargetBookmakers([])

      expect(filtered.length).toBe(0)
    })
  })
})

// ============================================================================
// Odds Parsing Tests
// ============================================================================

describe('Market Odds - Odds Parsing', () => {
  describe('parseBookmakerOdds', () => {
    it('parses valid bookmaker odds correctly', () => {
      const bookmaker = {
        name: 'Bet365',
        bets: [
          {
            id: 1,
            name: 'Match Winner',
            values: [
              { value: 'Home', odd: '2.10' },
              { value: 'Draw', odd: '3.40' },
              { value: 'Away', odd: '3.20' },
            ],
          },
        ],
      }

      const result = parseBookmakerOdds(bookmaker)

      expect(result).not.toBeNull()
      // Implied probability = (1/odds) * 100
      expect(result!.home).toBeCloseTo((1 / 2.1) * 100, 1) // ~47.6%
      expect(result!.draw).toBeCloseTo((1 / 3.4) * 100, 1) // ~29.4%
      expect(result!.away).toBeCloseTo((1 / 3.2) * 100, 1) // ~31.3%
    })

    it('finds Match Winner bet by id=1', () => {
      const bookmaker = {
        name: 'Pinnacle',
        bets: [
          { id: 2, name: 'Over/Under', values: [] },
          {
            id: 1,
            name: 'Different Name',
            values: [
              { value: 'Home', odd: '2.00' },
              { value: 'Draw', odd: '3.50' },
              { value: 'Away', odd: '3.00' },
            ],
          },
        ],
      }

      const result = parseBookmakerOdds(bookmaker)

      expect(result).not.toBeNull()
    })

    it('finds Match Winner bet by name', () => {
      const bookmaker = {
        name: 'Unibet',
        bets: [
          {
            id: 99,
            name: 'Match Winner',
            values: [
              { value: 'Home', odd: '2.00' },
              { value: 'Draw', odd: '3.50' },
              { value: 'Away', odd: '3.00' },
            ],
          },
        ],
      }

      const result = parseBookmakerOdds(bookmaker)

      expect(result).not.toBeNull()
    })

    it('returns null when Match Winner bet not found', () => {
      const bookmaker = {
        name: 'Bet365',
        bets: [
          { id: 2, name: 'Over/Under', values: [] },
          { id: 3, name: 'Both Teams Score', values: [] },
        ],
      }

      const result = parseBookmakerOdds(bookmaker)

      expect(result).toBeNull()
    })

    it('returns null when Home value is missing', () => {
      const bookmaker = {
        name: 'Bet365',
        bets: [
          {
            id: 1,
            name: 'Match Winner',
            values: [
              { value: 'Draw', odd: '3.40' },
              { value: 'Away', odd: '3.20' },
            ],
          },
        ],
      }

      const result = parseBookmakerOdds(bookmaker)

      expect(result).toBeNull()
    })

    it('returns null when Draw value is missing', () => {
      const bookmaker = {
        name: 'Bet365',
        bets: [
          {
            id: 1,
            name: 'Match Winner',
            values: [
              { value: 'Home', odd: '2.10' },
              { value: 'Away', odd: '3.20' },
            ],
          },
        ],
      }

      const result = parseBookmakerOdds(bookmaker)

      expect(result).toBeNull()
    })

    it('returns null when Away value is missing', () => {
      const bookmaker = {
        name: 'Bet365',
        bets: [
          {
            id: 1,
            name: 'Match Winner',
            values: [
              { value: 'Home', odd: '2.10' },
              { value: 'Draw', odd: '3.40' },
            ],
          },
        ],
      }

      const result = parseBookmakerOdds(bookmaker)

      expect(result).toBeNull()
    })

    it('returns null when odds are not valid numbers', () => {
      const bookmaker = {
        name: 'Bet365',
        bets: [
          {
            id: 1,
            name: 'Match Winner',
            values: [
              { value: 'Home', odd: 'N/A' },
              { value: 'Draw', odd: '3.40' },
              { value: 'Away', odd: '3.20' },
            ],
          },
        ],
      }

      const result = parseBookmakerOdds(bookmaker)

      expect(result).toBeNull()
    })

    it('returns null when bets array is empty', () => {
      const bookmaker = {
        name: 'Bet365',
        bets: [],
      }

      const result = parseBookmakerOdds(bookmaker)

      expect(result).toBeNull()
    })
  })
})

// ============================================================================
// Edge Cases and Integration
// ============================================================================

describe('Market Odds - Edge Cases', () => {
  it('handles very low odds (heavy favorite)', () => {
    const probabilities = [{ home: 80, draw: 12, away: 13 }] // ~1.25 odds for home

    const result = calculateMarketConsensus(probabilities)

    expect(result.fairProbabilities.home).toBeGreaterThan(70)
    expect(result.fairOdds.home).toBeLessThan(1.5)
  })

  it('handles very high odds (longshot)', () => {
    const probabilities = [{ home: 8, draw: 22, away: 75 }] // ~12.5 odds for home

    const result = calculateMarketConsensus(probabilities)

    expect(result.fairProbabilities.home).toBeLessThan(10)
    expect(result.fairOdds.home).toBeGreaterThan(10)
  })

  it('handles equal probabilities (three-way split)', () => {
    const probabilities = [{ home: 35, draw: 35, away: 35 }] // 105% total

    const result = calculateMarketConsensus(probabilities)

    // All fair probabilities should be equal (~33.33%)
    expect(result.fairProbabilities.home).toBeCloseTo(33.33, 1)
    expect(result.fairProbabilities.draw).toBeCloseTo(33.33, 1)
    expect(result.fairProbabilities.away).toBeCloseTo(33.33, 1)
  })

  it('handles realistic Allsvenskan match odds', () => {
    // Typical Swedish league match: home slightly favored
    const probabilities = [
      { home: 45.45, draw: 29.41, away: 31.25 }, // Pinnacle: 2.20 / 3.40 / 3.20
      { home: 47.62, draw: 28.57, away: 30.3 }, // Bet365: 2.10 / 3.50 / 3.30
      { home: 46.51, draw: 29.41, away: 30.3 }, // Unibet: 2.15 / 3.40 / 3.30
    ]

    const result = calculateMarketConsensus(probabilities)

    // Fair probabilities should be reasonable
    expect(result.fairProbabilities.home).toBeGreaterThan(40)
    expect(result.fairProbabilities.home).toBeLessThan(50)
    expect(result.fairProbabilities.draw).toBeGreaterThan(25)
    expect(result.fairProbabilities.draw).toBeLessThan(30)
    expect(result.averageMargin).toBeGreaterThan(4)
    expect(result.averageMargin).toBeLessThan(10)
  })
})
