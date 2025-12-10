import { describe, it, expect } from 'vitest'
import type { BettingSystem, CouponSelection } from '~/types'

// ============================================================================
// Test the pure logic extracted from UtgangsteckenEditor component
// ============================================================================

// Calculate required count of utgångstecken
const getRequiredCount = (system: BettingSystem): number => {
  return system.helgarderingar + system.halvgarderingar
}

// Get hedged matches (matches with lowest EVs that need utgångstecken)
const getHedgedMatches = (
  predictions: CouponSelection[],
  requiredCount: number
): CouponSelection[] => {
  const sorted = [...predictions].sort((a, b) => a.expected_value - b.expected_value)
  return sorted.slice(0, requiredCount)
}

// Get AI suggestion for a match
const getAISuggestion = (match: CouponSelection): string => {
  return match.selection.length === 1 ? match.selection : match.selection[0] || '1'
}

// Auto-fill utgångstecken from AI suggestions
const autoFillFromAI = (hedgedMatches: CouponSelection[]): Record<number, string> => {
  const utgangstecken: Record<number, string> = {}
  hedgedMatches.forEach(match => {
    utgangstecken[match.matchNumber] = getAISuggestion(match)
  })
  return utgangstecken
}

// Validate utgångstecken selection completeness
const isSelectionComplete = (
  selectedUtgangstecken: Record<number, string>,
  requiredCount: number
): boolean => {
  return Object.keys(selectedUtgangstecken).length >= requiredCount
}

// Get incomplete selection message
const getIncompleteMessage = (selectedCount: number, requiredCount: number): string => {
  return `Please select utgångstecken for all ${requiredCount} hedged matches. ${selectedCount}/${requiredCount} selected.`
}

// ============================================================================
// Test Data Factories
// ============================================================================

const createBettingSystem = (overrides: Partial<BettingSystem> = {}): BettingSystem => ({
  id: 'R-4-5-4',
  type: 'R',
  helgarderingar: 4,
  halvgarderingar: 5,
  rows: 192,
  ...overrides,
})

const createCouponSelection = (
  matchNumber: number,
  selection: string,
  expectedValue: number,
  isSpik: boolean = false
): CouponSelection => ({
  matchNumber,
  homeTeam: `Home ${matchNumber}`,
  awayTeam: `Away ${matchNumber}`,
  selection,
  is_spik: isSpik,
  expected_value: expectedValue,
  reasoning: 'Test selection',
})

const createTestPredictions = (): CouponSelection[] => [
  createCouponSelection(1, '1', 80, true),
  createCouponSelection(2, 'X', 45, false),
  createCouponSelection(3, '2', 30, false),
  createCouponSelection(4, '1X', 25, false),
  createCouponSelection(5, '12', 50, false),
  createCouponSelection(6, '1', 75, true),
  createCouponSelection(7, 'X2', 35, false),
  createCouponSelection(8, '2', 60, false),
  createCouponSelection(9, '1', 90, true),
  createCouponSelection(10, 'X', 40, false),
  createCouponSelection(11, '1X2', 20, false),
  createCouponSelection(12, '2', 55, false),
  createCouponSelection(13, '1', 85, true),
]

// ============================================================================
// Tests
// ============================================================================

describe('UtgangsteckenEditor', () => {
  // ============================================================================
  // getRequiredCount Tests
  // ============================================================================

  describe('getRequiredCount', () => {
    it('calculates required count correctly', () => {
      const system = createBettingSystem({ helgarderingar: 4, halvgarderingar: 5 })
      expect(getRequiredCount(system)).toBe(9)
    })

    it('returns 0 when no hedges', () => {
      const system = createBettingSystem({ helgarderingar: 0, halvgarderingar: 0 })
      expect(getRequiredCount(system)).toBe(0)
    })

    it('handles only helgarderingar', () => {
      const system = createBettingSystem({ helgarderingar: 5, halvgarderingar: 0 })
      expect(getRequiredCount(system)).toBe(5)
    })

    it('handles only halvgarderingar', () => {
      const system = createBettingSystem({ helgarderingar: 0, halvgarderingar: 8 })
      expect(getRequiredCount(system)).toBe(8)
    })
  })

  // ============================================================================
  // getHedgedMatches Tests
  // ============================================================================

  describe('getHedgedMatches', () => {
    it('returns matches sorted by lowest EV first', () => {
      const predictions = createTestPredictions()
      const hedged = getHedgedMatches(predictions, 5)

      // Should return 5 matches with lowest EVs
      expect(hedged).toHaveLength(5)
      // Verify they're sorted by EV ascending
      for (let i = 0; i < hedged.length - 1; i++) {
        expect(hedged[i]!.expected_value).toBeLessThanOrEqual(hedged[i + 1]!.expected_value)
      }
    })

    it('returns empty array when requiredCount is 0', () => {
      const predictions = createTestPredictions()
      const hedged = getHedgedMatches(predictions, 0)
      expect(hedged).toHaveLength(0)
    })

    it('returns all predictions when requiredCount exceeds length', () => {
      const predictions = createTestPredictions()
      const hedged = getHedgedMatches(predictions, 20)
      expect(hedged).toHaveLength(predictions.length)
    })

    it('correctly identifies matches with lowest EVs', () => {
      const predictions = createTestPredictions()
      const hedged = getHedgedMatches(predictions, 3)

      // The 3 lowest EVs are: match 11 (20), match 4 (25), match 3 (30)
      const evs = hedged.map(m => m.expected_value)
      expect(evs[0]).toBe(20) // Match 11
      expect(evs[1]).toBe(25) // Match 4
      expect(evs[2]).toBe(30) // Match 3
    })

    it('does not mutate original array', () => {
      const predictions = createTestPredictions()
      const originalOrder = predictions.map(p => p.matchNumber)

      getHedgedMatches(predictions, 5)

      const newOrder = predictions.map(p => p.matchNumber)
      expect(newOrder).toEqual(originalOrder)
    })
  })

  // ============================================================================
  // getAISuggestion Tests
  // ============================================================================

  describe('getAISuggestion', () => {
    it('returns single selection as-is', () => {
      const match = createCouponSelection(1, '1', 80)
      expect(getAISuggestion(match)).toBe('1')
    })

    it('returns single X as-is', () => {
      const match = createCouponSelection(1, 'X', 50)
      expect(getAISuggestion(match)).toBe('X')
    })

    it('returns single 2 as-is', () => {
      const match = createCouponSelection(1, '2', 40)
      expect(getAISuggestion(match)).toBe('2')
    })

    it('returns first character of double selection', () => {
      const match = createCouponSelection(1, '1X', 60)
      expect(getAISuggestion(match)).toBe('1')
    })

    it('returns first character of X2 selection', () => {
      const match = createCouponSelection(1, 'X2', 45)
      expect(getAISuggestion(match)).toBe('X')
    })

    it('returns first character of 12 selection', () => {
      const match = createCouponSelection(1, '12', 55)
      expect(getAISuggestion(match)).toBe('1')
    })

    it('returns first character of triple selection', () => {
      const match = createCouponSelection(1, '1X2', 33)
      expect(getAISuggestion(match)).toBe('1')
    })

    it('returns 1 as fallback for empty selection', () => {
      const match = createCouponSelection(1, '', 50)
      expect(getAISuggestion(match)).toBe('1')
    })
  })

  // ============================================================================
  // autoFillFromAI Tests
  // ============================================================================

  describe('autoFillFromAI', () => {
    it('fills utgångstecken for all hedged matches', () => {
      const hedgedMatches = [
        createCouponSelection(1, '1', 20),
        createCouponSelection(2, 'X', 25),
        createCouponSelection(3, '2', 30),
      ]

      const result = autoFillFromAI(hedgedMatches)

      expect(Object.keys(result)).toHaveLength(3)
      expect(result[1]).toBe('1')
      expect(result[2]).toBe('X')
      expect(result[3]).toBe('2')
    })

    it('uses first character for multi-sign matches', () => {
      const hedgedMatches = [
        createCouponSelection(1, '1X', 20),
        createCouponSelection(2, 'X2', 25),
        createCouponSelection(3, '1X2', 30),
      ]

      const result = autoFillFromAI(hedgedMatches)

      expect(result[1]).toBe('1')
      expect(result[2]).toBe('X')
      expect(result[3]).toBe('1')
    })

    it('returns empty object for empty hedgedMatches', () => {
      const result = autoFillFromAI([])
      expect(result).toEqual({})
    })

    it('preserves match numbers correctly', () => {
      const hedgedMatches = [
        createCouponSelection(5, '1', 20),
        createCouponSelection(8, 'X', 25),
        createCouponSelection(13, '2', 30),
      ]

      const result = autoFillFromAI(hedgedMatches)

      expect(
        Object.keys(result)
          .map(Number)
          .sort((a, b) => a - b)
      ).toEqual([5, 8, 13])
    })
  })

  // ============================================================================
  // isSelectionComplete Tests
  // ============================================================================

  describe('isSelectionComplete', () => {
    it('returns true when selection count equals required', () => {
      const selected = { 1: '1', 2: 'X', 3: '2' }
      expect(isSelectionComplete(selected, 3)).toBe(true)
    })

    it('returns true when selection count exceeds required', () => {
      const selected = { 1: '1', 2: 'X', 3: '2', 4: '1' }
      expect(isSelectionComplete(selected, 3)).toBe(true)
    })

    it('returns false when selection count is less than required', () => {
      const selected = { 1: '1', 2: 'X' }
      expect(isSelectionComplete(selected, 3)).toBe(false)
    })

    it('returns true when requiredCount is 0', () => {
      const selected = {}
      expect(isSelectionComplete(selected, 0)).toBe(true)
    })

    it('returns false for empty selection with positive required', () => {
      expect(isSelectionComplete({}, 5)).toBe(false)
    })
  })

  // ============================================================================
  // getIncompleteMessage Tests
  // ============================================================================

  describe('getIncompleteMessage', () => {
    it('generates correct message', () => {
      const message = getIncompleteMessage(2, 5)
      expect(message).toBe('Please select utgångstecken for all 5 hedged matches. 2/5 selected.')
    })

    it('handles zero selected', () => {
      const message = getIncompleteMessage(0, 9)
      expect(message).toBe('Please select utgångstecken for all 9 hedged matches. 0/9 selected.')
    })

    it('handles complete selection', () => {
      const message = getIncompleteMessage(5, 5)
      expect(message).toBe('Please select utgångstecken for all 5 hedged matches. 5/5 selected.')
    })
  })

  // ============================================================================
  // Integration Tests - Full Flow
  // ============================================================================

  describe('Full Flow', () => {
    it('calculates hedged matches and auto-fills correctly', () => {
      const system = createBettingSystem({ helgarderingar: 3, halvgarderingar: 2 })
      const predictions = createTestPredictions()

      const requiredCount = getRequiredCount(system)
      expect(requiredCount).toBe(5)

      const hedgedMatches = getHedgedMatches(predictions, requiredCount)
      expect(hedgedMatches).toHaveLength(5)

      const utgangstecken = autoFillFromAI(hedgedMatches)
      expect(Object.keys(utgangstecken)).toHaveLength(5)

      expect(isSelectionComplete(utgangstecken, requiredCount)).toBe(true)
    })

    it('handles spik-only system (no hedges needed)', () => {
      const system = createBettingSystem({ helgarderingar: 0, halvgarderingar: 0 })
      const predictions = createTestPredictions()

      const requiredCount = getRequiredCount(system)
      expect(requiredCount).toBe(0)

      const hedgedMatches = getHedgedMatches(predictions, requiredCount)
      expect(hedgedMatches).toHaveLength(0)

      const utgangstecken = autoFillFromAI(hedgedMatches)
      expect(utgangstecken).toEqual({})

      expect(isSelectionComplete(utgangstecken, requiredCount)).toBe(true)
    })

    it('handles maximum hedges (all matches)', () => {
      const system = createBettingSystem({ helgarderingar: 8, halvgarderingar: 5 })
      const predictions = createTestPredictions()

      const requiredCount = getRequiredCount(system)
      expect(requiredCount).toBe(13)

      const hedgedMatches = getHedgedMatches(predictions, requiredCount)
      expect(hedgedMatches).toHaveLength(13)

      const utgangstecken = autoFillFromAI(hedgedMatches)
      expect(Object.keys(utgangstecken)).toHaveLength(13)
    })
  })
})
