/* eslint-disable @typescript-eslint/no-explicit-any -- Test file with mock data */
import { describe, it, expect, vi } from 'vitest'

// Mock the console methods to avoid noisy output
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

// ============================================================================
// Value Signal Detection Logic (extracted from prediction-service.ts)
// ============================================================================

const VALUE_THRESHOLD = 5 // 5% difference threshold

interface ValueSignal {
  outcome: 'home' | 'draw' | 'away'
  direction: 'overvalues' | 'undervalues'
  difference: number
}

/**
 * Detect value signals by comparing Svenska Spel probabilities with market consensus.
 * A value signal is flagged when the difference exceeds the threshold (5%).
 *
 * - Positive difference means Svenska Spel overvalues the outcome
 *   (implies value on OTHER outcomes)
 * - Negative difference means Svenska Spel undervalues the outcome
 *   (implies value ON this outcome)
 */
function detectValueSignals(
  svenskaSpelProbs: { home: number; draw: number; away: number },
  marketConsensusProbs: { home: number; draw: number; away: number }
): ValueSignal[] {
  const signals: ValueSignal[] = []

  const homeDiff = svenskaSpelProbs.home - marketConsensusProbs.home
  const drawDiff = svenskaSpelProbs.draw - marketConsensusProbs.draw
  const awayDiff = svenskaSpelProbs.away - marketConsensusProbs.away

  if (Math.abs(homeDiff) > VALUE_THRESHOLD) {
    signals.push({
      outcome: 'home',
      direction: homeDiff > 0 ? 'overvalues' : 'undervalues',
      difference: Math.abs(homeDiff),
    })
  }

  if (Math.abs(drawDiff) > VALUE_THRESHOLD) {
    signals.push({
      outcome: 'draw',
      direction: drawDiff > 0 ? 'overvalues' : 'undervalues',
      difference: Math.abs(drawDiff),
    })
  }

  if (Math.abs(awayDiff) > VALUE_THRESHOLD) {
    signals.push({
      outcome: 'away',
      direction: awayDiff > 0 ? 'overvalues' : 'undervalues',
      difference: Math.abs(awayDiff),
    })
  }

  return signals
}

/**
 * Format value signals for display (as used in prediction context)
 */
function formatValueSignals(signals: ValueSignal[]): string[] {
  return signals.map(signal => {
    const outcomeLabel = signal.outcome === 'home' ? 'Home Win' : signal.outcome === 'draw' ? 'Draw' : 'Away Win'
    return `Svenska Spel ${signal.direction} ${outcomeLabel} by ${signal.difference.toFixed(1)}%`
  })
}

// ============================================================================
// Value Signal Detection Tests
// ============================================================================

describe('Value Signal Detection', () => {
  describe('5% threshold detection', () => {
    it('flags home value signal when difference > 5%', () => {
      const ssProbs = { home: 50, draw: 25, away: 25 }
      const marketProbs = { home: 40, draw: 30, away: 30 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      expect(signals).toHaveLength(2) // home +10%, draw -5%
      expect(signals.find(s => s.outcome === 'home')).toBeDefined()
      expect(signals.find(s => s.outcome === 'home')?.difference).toBeCloseTo(10, 1)
    })

    it('flags draw value signal when difference > 5%', () => {
      const ssProbs = { home: 40, draw: 35, away: 25 }
      const marketProbs = { home: 40, draw: 28, away: 32 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      expect(signals.find(s => s.outcome === 'draw')).toBeDefined()
      expect(signals.find(s => s.outcome === 'draw')?.difference).toBeCloseTo(7, 1)
    })

    it('flags away value signal when difference > 5%', () => {
      const ssProbs = { home: 40, draw: 30, away: 30 }
      const marketProbs = { home: 40, draw: 30, away: 38 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      expect(signals.find(s => s.outcome === 'away')).toBeDefined()
      expect(signals.find(s => s.outcome === 'away')?.difference).toBeCloseTo(8, 1)
    })

    it('does not flag when difference is exactly 5%', () => {
      const ssProbs = { home: 45, draw: 30, away: 25 }
      const marketProbs = { home: 40, draw: 30, away: 30 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      // 5% is not > 5%, so no flag
      expect(signals.find(s => s.outcome === 'home')).toBeUndefined()
    })

    it('does not flag when difference is less than 5%', () => {
      const ssProbs = { home: 42, draw: 29, away: 29 }
      const marketProbs = { home: 40, draw: 30, away: 30 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      expect(signals).toHaveLength(0)
    })

    it('returns empty array when all differences are below threshold', () => {
      const ssProbs = { home: 40, draw: 30, away: 30 }
      const marketProbs = { home: 40, draw: 30, away: 30 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      expect(signals).toHaveLength(0)
    })

    it('can flag multiple outcomes at once', () => {
      const ssProbs = { home: 50, draw: 35, away: 15 }
      const marketProbs = { home: 35, draw: 25, away: 40 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      expect(signals.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('overvalued/undervalued categorization', () => {
    it('marks as overvalued when SS probability > market', () => {
      const ssProbs = { home: 50, draw: 30, away: 20 }
      const marketProbs = { home: 40, draw: 30, away: 30 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      const homeSignal = signals.find(s => s.outcome === 'home')
      expect(homeSignal?.direction).toBe('overvalues')
    })

    it('marks as undervalued when SS probability < market', () => {
      const ssProbs = { home: 30, draw: 30, away: 40 }
      const marketProbs = { home: 40, draw: 30, away: 30 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      const homeSignal = signals.find(s => s.outcome === 'home')
      expect(homeSignal?.direction).toBe('undervalues')
    })

    it('correctly categorizes mixed signals', () => {
      const ssProbs = { home: 50, draw: 20, away: 30 }
      const marketProbs = { home: 40, draw: 30, away: 30 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      const homeSignal = signals.find(s => s.outcome === 'home')
      const drawSignal = signals.find(s => s.outcome === 'draw')

      expect(homeSignal?.direction).toBe('overvalues')
      expect(drawSignal?.direction).toBe('undervalues')
    })
  })

  describe('difference calculation accuracy', () => {
    it('calculates difference correctly for home', () => {
      const ssProbs = { home: 47.5, draw: 30, away: 22.5 }
      const marketProbs = { home: 40.0, draw: 30, away: 30.0 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      const homeSignal = signals.find(s => s.outcome === 'home')
      expect(homeSignal?.difference).toBeCloseTo(7.5, 1)
    })

    it('calculates difference correctly for draw', () => {
      const ssProbs = { home: 40, draw: 22.3, away: 37.7 }
      const marketProbs = { home: 40, draw: 30.0, away: 30.0 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      const drawSignal = signals.find(s => s.outcome === 'draw')
      expect(drawSignal?.difference).toBeCloseTo(7.7, 1)
    })

    it('handles decimal probabilities', () => {
      const ssProbs = { home: 42.86, draw: 28.57, away: 28.57 }
      const marketProbs = { home: 35.0, draw: 32.5, away: 32.5 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      expect(signals.length).toBeGreaterThan(0)
      const homeSignal = signals.find(s => s.outcome === 'home')
      expect(homeSignal?.difference).toBeCloseTo(7.86, 1)
    })
  })

  describe('edge cases', () => {
    it('handles zero probabilities', () => {
      const ssProbs = { home: 0, draw: 50, away: 50 }
      const marketProbs = { home: 10, draw: 45, away: 45 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      const homeSignal = signals.find(s => s.outcome === 'home')
      expect(homeSignal?.direction).toBe('undervalues')
      expect(homeSignal?.difference).toBeCloseTo(10, 1)
    })

    it('handles very small differences', () => {
      const ssProbs = { home: 40.1, draw: 30.0, away: 29.9 }
      const marketProbs = { home: 40.0, draw: 30.0, away: 30.0 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      expect(signals).toHaveLength(0)
    })

    it('handles identical probabilities', () => {
      const ssProbs = { home: 33.33, draw: 33.33, away: 33.34 }
      const marketProbs = { home: 33.33, draw: 33.33, away: 33.34 }

      const signals = detectValueSignals(ssProbs, marketProbs)

      expect(signals).toHaveLength(0)
    })
  })
})

// ============================================================================
// Value Signal Formatting Tests
// ============================================================================

describe('Value Signal Formatting', () => {
  it('formats home win overvalued signal correctly', () => {
    const signals: ValueSignal[] = [
      { outcome: 'home', direction: 'overvalues', difference: 7.5 },
    ]

    const formatted = formatValueSignals(signals)

    expect(formatted[0]).toBe('Svenska Spel overvalues Home Win by 7.5%')
  })

  it('formats draw undervalued signal correctly', () => {
    const signals: ValueSignal[] = [
      { outcome: 'draw', direction: 'undervalues', difference: 6.2 },
    ]

    const formatted = formatValueSignals(signals)

    expect(formatted[0]).toBe('Svenska Spel undervalues Draw by 6.2%')
  })

  it('formats away win signal correctly', () => {
    const signals: ValueSignal[] = [
      { outcome: 'away', direction: 'overvalues', difference: 8.0 },
    ]

    const formatted = formatValueSignals(signals)

    expect(formatted[0]).toBe('Svenska Spel overvalues Away Win by 8.0%')
  })

  it('formats multiple signals', () => {
    const signals: ValueSignal[] = [
      { outcome: 'home', direction: 'overvalues', difference: 10.0 },
      { outcome: 'draw', direction: 'undervalues', difference: 5.5 },
      { outcome: 'away', direction: 'undervalues', difference: 4.5 },
    ]

    const formatted = formatValueSignals(signals)

    expect(formatted).toHaveLength(3)
    expect(formatted[0]).toContain('Home Win')
    expect(formatted[1]).toContain('Draw')
    expect(formatted[2]).toContain('Away Win')
  })

  it('rounds difference to one decimal place', () => {
    const signals: ValueSignal[] = [
      { outcome: 'home', direction: 'overvalues', difference: 7.567 },
    ]

    const formatted = formatValueSignals(signals)

    expect(formatted[0]).toBe('Svenska Spel overvalues Home Win by 7.6%')
  })

  it('returns empty array for no signals', () => {
    const formatted = formatValueSignals([])

    expect(formatted).toHaveLength(0)
  })
})

// ============================================================================
// Integration Tests - Real-world Scenarios
// ============================================================================

describe('Value Signal Detection - Real-world Scenarios', () => {
  it('identifies value on home team when Svenska Spel is too low', () => {
    // Market consensus: Home favorite at 45%
    // Svenska Spel: Home at 38% (offering better odds)
    const ssProbs = { home: 38, draw: 32, away: 30 }
    const marketProbs = { home: 45, draw: 28, away: 27 }

    const signals = detectValueSignals(ssProbs, marketProbs)

    const homeSignal = signals.find(s => s.outcome === 'home')
    expect(homeSignal).toBeDefined()
    expect(homeSignal?.direction).toBe('undervalues')
    // This means Svenska Spel offers VALUE on home win
  })

  it('identifies value against home team when Svenska Spel overvalues', () => {
    // Market consensus: Home at 35%
    // Svenska Spel: Home at 45% (poor odds for home)
    const ssProbs = { home: 45, draw: 28, away: 27 }
    const marketProbs = { home: 35, draw: 32, away: 33 }

    const signals = detectValueSignals(ssProbs, marketProbs)

    const homeSignal = signals.find(s => s.outcome === 'home')
    expect(homeSignal).toBeDefined()
    expect(homeSignal?.direction).toBe('overvalues')
    // This means Svenska Spel offers VALUE on X2 (not home)
  })

  it('detects draw value in evenly matched game', () => {
    // Market consensus: Draw at 32%
    // Svenska Spel: Draw at 25% (offering better odds on draw)
    const ssProbs = { home: 40, draw: 25, away: 35 }
    const marketProbs = { home: 38, draw: 32, away: 30 }

    const signals = detectValueSignals(ssProbs, marketProbs)

    const drawSignal = signals.find(s => s.outcome === 'draw')
    expect(drawSignal).toBeDefined()
    expect(drawSignal?.direction).toBe('undervalues')
  })

  it('handles typical Allsvenskan match with slight discrepancies', () => {
    // Typical Allsvenskan home favorite match
    // Difference within normal range - no signals
    const ssProbs = { home: 42, draw: 28, away: 30 }
    const marketProbs = { home: 40, draw: 30, away: 30 }

    const signals = detectValueSignals(ssProbs, marketProbs)

    expect(signals).toHaveLength(0)
  })

  it('flags significant discrepancy in derby match', () => {
    // Derby where market sees it as close but Svenska Spel favors home
    const ssProbs = { home: 50, draw: 25, away: 25 }
    const marketProbs = { home: 35, draw: 33, away: 32 }

    const signals = detectValueSignals(ssProbs, marketProbs)

    expect(signals.length).toBeGreaterThanOrEqual(2)
    expect(signals.find(s => s.outcome === 'home')?.direction).toBe('overvalues')
    expect(signals.find(s => s.outcome === 'draw')?.direction).toBe('undervalues')
  })
})
