/* eslint-disable @typescript-eslint/no-explicit-any -- Test file with mock data */
import { describe, it, expect } from 'vitest'
import type { CouponRow, CouponSelection, CouponStatus } from '~/types'

// ============================================================================
// Test the pure logic extracted from CouponDisplay component
// ============================================================================

// Type guard to check if coupon is a SystemCoupon (has rows)
function isSystemCoupon(c: any): boolean {
  return 'rows' in c && Array.isArray(c.rows)
}

// Get match outcomes from coupon rows
const getMatchOutcomes = (rows: CouponRow[], matchNum: number): string[] => {
  if (rows.length === 0) return []

  const outcomes = new Set<string>()
  rows.forEach(row => {
    const pick = row.picks[matchNum - 1]
    if (pick) outcomes.add(pick)
  })

  return Array.from(outcomes).sort()
}

// Get match info from selections
const getMatchInfo = (selections: CouponSelection[] | undefined, matchNum: number) => {
  return selections?.find(s => s.matchNumber === matchNum)
}

// Get badge color for outcome
const getOutcomeBadgeColor = (
  matchInfo: CouponSelection | undefined,
  outcome: string
): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' => {
  if (matchInfo?.is_spik) {
    return 'warning'
  }

  // Check if this is the AI's predicted outcome
  if (matchInfo?.selection === outcome || matchInfo?.selection.includes(outcome)) {
    return 'primary'
  }

  return 'neutral'
}

// Get badge variant for outcome
const getOutcomeBadgeVariant = (
  matchInfo: CouponSelection | undefined,
  outcome: string
): 'solid' | 'soft' | 'outline' => {
  // Spik is solid
  if (matchInfo?.is_spik) {
    return 'solid'
  }

  // AI prediction is soft
  if (matchInfo?.selection === outcome || matchInfo?.selection.includes(outcome)) {
    return 'soft'
  }

  return 'outline'
}

// Get coverage text for a match
const getMatchCoverageText = (
  rows: CouponRow[],
  matchNum: number,
  matchInfo: CouponSelection | undefined
): string => {
  const outcomes = getMatchOutcomes(rows, matchNum)

  if (matchInfo?.is_spik) {
    return 'Spik'
  }

  if (outcomes.length === 3) {
    return 'Helgarderad'
  }

  if (outcomes.length === 2) {
    return 'Halvgarderad'
  }

  return 'Fast tecken'
}

// Status color mapping
const getStatusColor = (
  status: CouponStatus
): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' => {
  switch (status) {
    case 'generated':
      return 'neutral'
    case 'saved':
      return 'info'
    case 'played':
      return 'success'
    case 'analyzed':
      return 'primary'
    default:
      return 'neutral'
  }
}

// Format status for display
const formatStatus = (status: CouponStatus): string => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// Generate CSV from coupon rows
const generateCSV = (rows: CouponRow[], matchCount: number): string => {
  if (rows.length === 0) return ''

  let csv = 'Row,' + Array.from({ length: matchCount }, (_, i) => i + 1).join(',') + '\n'

  rows.forEach(row => {
    csv += `${row.rowNumber},${row.picks.join(',')}\n`
  })

  return csv
}

// Generate coupon text for clipboard
const generateCouponText = (
  rows: CouponRow[],
  drawNumber: number,
  systemId: string,
  totalCost: number,
  matchCount: number
): string => {
  if (rows.length === 0) return ''

  let text = `Coupon for Draw #${drawNumber}\n`
  text += `System: ${systemId}\n`
  text += `Total Rows: ${rows.length}\n`
  text += `Total Cost: ${totalCost} SEK\n\n`

  text += 'Row | ' + Array.from({ length: matchCount }, (_, i) => i + 1).join(' | ') + '\n'
  text += '-'.repeat(matchCount * 4 + 6) + '\n'

  rows.forEach(row => {
    text += `${row.rowNumber.toString().padStart(3)} | ${row.picks.join(' | ')}\n`
  })

  return text
}

// ============================================================================
// Test Data Factories
// ============================================================================

const createCouponRow = (rowNumber: number, picks: string[]): CouponRow => ({
  rowNumber,
  picks,
})

const createSelection = (
  matchNumber: number,
  selection: string,
  isSpik: boolean = false
): CouponSelection => ({
  matchNumber,
  homeTeam: `Home ${matchNumber}`,
  awayTeam: `Away ${matchNumber}`,
  selection,
  is_spik: isSpik,
  expected_value: 5.0,
  reasoning: 'Test selection',
})

const createTestRows = (): CouponRow[] => [
  createCouponRow(1, ['1', '1', 'X', '1', '2', '1', 'X', '2', '1', 'X', '2', '1', 'X']),
  createCouponRow(2, ['1', '1', 'X', '1', '2', '1', 'X', '2', '1', 'X', '2', '1', '2']),
  createCouponRow(3, ['1', '1', 'X', '1', '2', '1', 'X', '2', '1', 'X', '2', '2', 'X']),
  createCouponRow(4, ['1', '1', 'X', '1', '2', '1', 'X', '2', '1', 'X', '2', '2', '2']),
]

const createTestSelections = (): CouponSelection[] =>
  Array.from({ length: 13 }, (_, i) => createSelection(i + 1, i < 10 ? '1' : '1X', i < 3))

// ============================================================================
// Tests
// ============================================================================

describe('CouponDisplay', () => {
  // ============================================================================
  // isSystemCoupon Tests
  // ============================================================================

  describe('isSystemCoupon', () => {
    it('returns true when coupon has rows array', () => {
      const coupon = { rows: [], selections: [] }
      expect(isSystemCoupon(coupon)).toBe(true)
    })

    it('returns false when coupon does not have rows', () => {
      const coupon = { selections: [] }
      expect(isSystemCoupon(coupon)).toBe(false)
    })

    it('returns false when rows is not an array', () => {
      const coupon = { rows: 'not an array', selections: [] }
      expect(isSystemCoupon(coupon)).toBe(false)
    })
  })

  // ============================================================================
  // getMatchOutcomes Tests
  // ============================================================================

  describe('getMatchOutcomes', () => {
    it('returns empty array for empty rows', () => {
      expect(getMatchOutcomes([], 1)).toEqual([])
    })

    it('returns unique outcomes for a match', () => {
      const rows = createTestRows()
      // Match 13: X, 2, X, 2 → ['2', 'X']
      expect(getMatchOutcomes(rows, 13)).toEqual(['2', 'X'])
    })

    it('returns all three outcomes for helgarderat match', () => {
      const rows = [
        createCouponRow(1, ['1', '1', 'X']),
        createCouponRow(2, ['1', 'X', 'X']),
        createCouponRow(3, ['1', '2', 'X']),
      ]
      // Match 2: 1, X, 2 → all outcomes
      expect(getMatchOutcomes(rows, 2)).toEqual(['1', '2', 'X'])
    })

    it('returns sorted outcomes', () => {
      const rows = [createCouponRow(1, ['2']), createCouponRow(2, ['1']), createCouponRow(3, ['X'])]
      expect(getMatchOutcomes(rows, 1)).toEqual(['1', '2', 'X'])
    })

    it('handles single outcome (spik)', () => {
      const rows = createTestRows()
      // Match 1: all '1' → ['1']
      expect(getMatchOutcomes(rows, 1)).toEqual(['1'])
    })
  })

  // ============================================================================
  // getMatchInfo Tests
  // ============================================================================

  describe('getMatchInfo', () => {
    it('returns selection for existing match', () => {
      const selections = createTestSelections()
      const info = getMatchInfo(selections, 1)
      expect(info).toBeDefined()
      expect(info?.matchNumber).toBe(1)
    })

    it('returns undefined for non-existent match', () => {
      const selections = createTestSelections()
      expect(getMatchInfo(selections, 99)).toBeUndefined()
    })

    it('returns undefined for undefined selections', () => {
      expect(getMatchInfo(undefined, 1)).toBeUndefined()
    })
  })

  // ============================================================================
  // getOutcomeBadgeColor Tests
  // ============================================================================

  describe('getOutcomeBadgeColor', () => {
    it('returns warning for spik match', () => {
      const matchInfo = createSelection(1, '1', true)
      expect(getOutcomeBadgeColor(matchInfo, '1')).toBe('warning')
    })

    it('returns primary for AI predicted single outcome', () => {
      const matchInfo = createSelection(1, '1', false)
      expect(getOutcomeBadgeColor(matchInfo, '1')).toBe('primary')
    })

    it('returns primary for outcome in AI double prediction', () => {
      const matchInfo = createSelection(1, '1X', false)
      expect(getOutcomeBadgeColor(matchInfo, '1')).toBe('primary')
      expect(getOutcomeBadgeColor(matchInfo, 'X')).toBe('primary')
    })

    it('returns neutral for non-predicted outcome', () => {
      const matchInfo = createSelection(1, '1', false)
      expect(getOutcomeBadgeColor(matchInfo, 'X')).toBe('neutral')
      expect(getOutcomeBadgeColor(matchInfo, '2')).toBe('neutral')
    })

    it('returns neutral when matchInfo is undefined', () => {
      expect(getOutcomeBadgeColor(undefined, '1')).toBe('neutral')
    })
  })

  // ============================================================================
  // getOutcomeBadgeVariant Tests
  // ============================================================================

  describe('getOutcomeBadgeVariant', () => {
    it('returns solid for spik match', () => {
      const matchInfo = createSelection(1, '1', true)
      expect(getOutcomeBadgeVariant(matchInfo, '1')).toBe('solid')
    })

    it('returns soft for AI predicted outcome', () => {
      const matchInfo = createSelection(1, '1X', false)
      expect(getOutcomeBadgeVariant(matchInfo, '1')).toBe('soft')
    })

    it('returns outline for non-predicted outcome', () => {
      const matchInfo = createSelection(1, '1', false)
      expect(getOutcomeBadgeVariant(matchInfo, 'X')).toBe('outline')
    })

    it('returns outline when matchInfo is undefined', () => {
      expect(getOutcomeBadgeVariant(undefined, '1')).toBe('outline')
    })
  })

  // ============================================================================
  // getMatchCoverageText Tests
  // ============================================================================

  describe('getMatchCoverageText', () => {
    const rows = createTestRows()

    it('returns "Spik" for spik match', () => {
      const matchInfo = createSelection(1, '1', true)
      expect(getMatchCoverageText(rows, 1, matchInfo)).toBe('Spik')
    })

    it('returns "Helgarderad" for 3 outcomes', () => {
      const rows = [createCouponRow(1, ['1']), createCouponRow(2, ['X']), createCouponRow(3, ['2'])]
      const matchInfo = createSelection(1, '1X2', false)
      expect(getMatchCoverageText(rows, 1, matchInfo)).toBe('Helgarderad')
    })

    it('returns "Halvgarderad" for 2 outcomes', () => {
      const rows = [createCouponRow(1, ['1']), createCouponRow(2, ['X'])]
      const matchInfo = createSelection(1, '1X', false)
      expect(getMatchCoverageText(rows, 1, matchInfo)).toBe('Halvgarderad')
    })

    it('returns "Fast tecken" for single outcome (non-spik)', () => {
      const rows = [createCouponRow(1, ['1']), createCouponRow(2, ['1'])]
      const matchInfo = createSelection(1, '1', false)
      expect(getMatchCoverageText(rows, 1, matchInfo)).toBe('Fast tecken')
    })
  })

  // ============================================================================
  // getStatusColor Tests
  // ============================================================================

  describe('getStatusColor', () => {
    it('returns neutral for generated', () => {
      expect(getStatusColor('generated')).toBe('neutral')
    })

    it('returns info for saved', () => {
      expect(getStatusColor('saved')).toBe('info')
    })

    it('returns success for played', () => {
      expect(getStatusColor('played')).toBe('success')
    })

    it('returns primary for analyzed', () => {
      expect(getStatusColor('analyzed')).toBe('primary')
    })
  })

  // ============================================================================
  // formatStatus Tests
  // ============================================================================

  describe('formatStatus', () => {
    it('capitalizes first letter of status', () => {
      expect(formatStatus('generated')).toBe('Generated')
      expect(formatStatus('saved')).toBe('Saved')
      expect(formatStatus('played')).toBe('Played')
      expect(formatStatus('analyzed')).toBe('Analyzed')
    })
  })

  // ============================================================================
  // generateCSV Tests
  // ============================================================================

  describe('generateCSV', () => {
    it('returns empty string for empty rows', () => {
      expect(generateCSV([], 13)).toBe('')
    })

    it('generates correct CSV header', () => {
      const rows = [createCouponRow(1, ['1', 'X', '2'])]
      const csv = generateCSV(rows, 3)
      expect(csv.startsWith('Row,1,2,3\n')).toBe(true)
    })

    it('generates correct CSV content', () => {
      const rows = [createCouponRow(1, ['1', 'X', '2']), createCouponRow(2, ['2', '1', 'X'])]
      const csv = generateCSV(rows, 3)
      expect(csv).toContain('1,1,X,2\n')
      expect(csv).toContain('2,2,1,X\n')
    })

    it('handles 13-match coupon', () => {
      const rows = createTestRows()
      const csv = generateCSV(rows, 13)
      expect(csv.split('\n')[0]).toBe('Row,1,2,3,4,5,6,7,8,9,10,11,12,13')
      // CSV ends with newline, so split produces empty string at end
      expect(csv.split('\n').filter(line => line.length > 0).length).toBe(5) // header + 4 rows
    })
  })

  // ============================================================================
  // generateCouponText Tests
  // ============================================================================

  describe('generateCouponText', () => {
    it('returns empty string for empty rows', () => {
      expect(generateCouponText([], 1, 'R-4-0-9-12', 9, 13)).toBe('')
    })

    it('includes draw number in header', () => {
      const rows = [createCouponRow(1, ['1', 'X', '2'])]
      const text = generateCouponText(rows, 123, 'R-4-0-9-12', 9, 3)
      expect(text).toContain('Draw #123')
    })

    it('includes system id', () => {
      const rows = [createCouponRow(1, ['1', 'X', '2'])]
      const text = generateCouponText(rows, 1, 'AI-Based', 9, 3)
      expect(text).toContain('System: AI-Based')
    })

    it('includes total rows count', () => {
      const rows = createTestRows()
      const text = generateCouponText(rows, 1, 'R-4-0-9-12', 4, 13)
      expect(text).toContain('Total Rows: 4')
    })

    it('includes total cost', () => {
      const rows = [createCouponRow(1, ['1', 'X', '2'])]
      const text = generateCouponText(rows, 1, 'test', 100, 3)
      expect(text).toContain('Total Cost: 100 SEK')
    })

    it('includes match column headers', () => {
      const rows = [createCouponRow(1, ['1', 'X', '2'])]
      const text = generateCouponText(rows, 1, 'test', 1, 3)
      expect(text).toContain('Row | 1 | 2 | 3')
    })

    it('includes row data', () => {
      const rows = [createCouponRow(1, ['1', 'X', '2']), createCouponRow(2, ['2', '1', 'X'])]
      const text = generateCouponText(rows, 1, 'test', 2, 3)
      expect(text).toContain('1 | X | 2')
      expect(text).toContain('2 | 1 | X')
    })
  })
})
