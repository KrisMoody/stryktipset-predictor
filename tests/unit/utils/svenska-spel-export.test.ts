import { describe, it, expect } from 'vitest'
import {
  validateCouponRow,
  validateForEnkelraderExport,
  validateSelection,
  validateForMSystemExport,
  getSelectionLength,
  calculateMSystemRowCount,
  generateEnkelraderContent,
  generateMSystemContent,
  generateExportFilename,
} from '~/utils/svenska-spel-export'
import type { CouponRow, CouponSelection } from '~/types'

// ============================================================================
// Test Utilities
// ============================================================================

const createValidRow = (rowNumber: number, picks?: string[]): CouponRow => ({
  rowNumber,
  picks: picks || ['1', 'X', '2', '1', '1', 'X', '2', '1', 'X', '2', '1', '1', '2'],
})

const createSelection = (matchNumber: number, selection: string): CouponSelection => ({
  matchNumber,
  homeTeam: `Home ${matchNumber}`,
  awayTeam: `Away ${matchNumber}`,
  selection,
  is_spik: selection.length === 1,
  expected_value: 5.0,
  reasoning: 'Test selection',
})

const create13Selections = (selectionPattern: string[]): CouponSelection[] => {
  return Array.from({ length: 13 }, (_, i) =>
    createSelection(i + 1, selectionPattern[i % selectionPattern.length])
  )
}

// ============================================================================
// validateCouponRow Tests
// ============================================================================

describe('validateCouponRow', () => {
  it('validates a correct row with 13 outcomes', () => {
    const row = createValidRow(1)
    expect(validateCouponRow(row)).toEqual({ valid: true })
  })

  it('rejects row with less than 13 picks', () => {
    const row: CouponRow = { rowNumber: 1, picks: ['1', 'X', '2'] }
    const result = validateCouponRow(row)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Expected 13 outcomes')
    expect(result.error).toContain('got 3')
  })

  it('rejects row with more than 13 picks', () => {
    const row: CouponRow = {
      rowNumber: 1,
      picks: ['1', 'X', '2', '1', '1', 'X', '2', '1', 'X', '2', '1', '1', '2', 'X'],
    }
    const result = validateCouponRow(row)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Expected 13 outcomes')
    expect(result.error).toContain('got 14')
  })

  it('rejects row with invalid outcome "3"', () => {
    const row: CouponRow = {
      rowNumber: 1,
      picks: ['1', 'X', '3', '1', '1', 'X', '2', '1', 'X', '2', '1', '1', '2'],
    }
    const result = validateCouponRow(row)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid outcome "3"')
    expect(result.error).toContain('Match 3')
  })

  it('accepts lowercase outcomes (x instead of X)', () => {
    const row: CouponRow = {
      rowNumber: 1,
      picks: ['1', 'x', '2', '1', '1', 'x', '2', '1', 'x', '2', '1', '1', '2'],
    }
    expect(validateCouponRow(row)).toEqual({ valid: true })
  })

  it('rejects empty string as outcome', () => {
    const row: CouponRow = {
      rowNumber: 1,
      picks: ['1', '', '2', '1', '1', 'X', '2', '1', 'X', '2', '1', '1', '2'],
    }
    const result = validateCouponRow(row)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid outcome')
  })
})

// ============================================================================
// validateForEnkelraderExport Tests
// ============================================================================

describe('validateForEnkelraderExport', () => {
  it('validates valid rows', () => {
    const rows = [createValidRow(1), createValidRow(2)]
    const result = validateForEnkelraderExport(rows)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects empty rows array', () => {
    const result = validateForEnkelraderExport([])
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('No rows to export')
  })

  it('rejects more than 50,000 rows', () => {
    const rows = Array.from({ length: 50001 }, (_, i) => createValidRow(i + 1))
    const result = validateForEnkelraderExport(rows)
    expect(result.isValid).toBe(false)
    expect(result.errors[0]).toContain('Too many rows')
    expect(result.errors[0]).toContain('50,000')
  })

  it('accepts exactly 50,000 rows', () => {
    const rows = Array.from({ length: 50000 }, (_, i) => createValidRow(i + 1))
    const result = validateForEnkelraderExport(rows)
    expect(result.isValid).toBe(true)
  })

  it('warns about duplicate rows', () => {
    const rows = [
      createValidRow(1),
      createValidRow(2), // Same picks as row 1
    ]
    const result = validateForEnkelraderExport(rows)
    expect(result.isValid).toBe(true) // Duplicates are warnings, not errors
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('Duplicate row')
  })

  it('collects all validation errors', () => {
    const rows = [
      { rowNumber: 1, picks: ['1', 'X', '2'] }, // Wrong count
      { rowNumber: 2, picks: ['1', 'X', '3', '1', '1', 'X', '2', '1', 'X', '2', '1', '1', '2'] }, // Invalid outcome
    ]
    const result = validateForEnkelraderExport(rows)
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})

// ============================================================================
// validateSelection Tests
// ============================================================================

describe('validateSelection', () => {
  it.each(['1', 'X', '2', '1X', 'X2', '12', '1X2'])('validates "%s" as valid', (selection) => {
    expect(validateSelection(selection, 1)).toEqual({ valid: true })
  })

  it('validates lowercase selections', () => {
    expect(validateSelection('x', 1)).toEqual({ valid: true })
    expect(validateSelection('1x', 1)).toEqual({ valid: true })
    expect(validateSelection('x2', 1)).toEqual({ valid: true })
    expect(validateSelection('1x2', 1)).toEqual({ valid: true })
  })

  it('rejects invalid selection "3"', () => {
    const result = validateSelection('3', 5)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Match 5')
    expect(result.error).toContain('Invalid selection "3"')
  })

  it('rejects invalid selection "XX"', () => {
    const result = validateSelection('XX', 1)
    expect(result.valid).toBe(false)
  })
})

// ============================================================================
// validateForMSystemExport Tests
// ============================================================================

describe('validateForMSystemExport', () => {
  it('validates valid M-system selections', () => {
    // Create selections that result in more than 1 row
    const selections = create13Selections(['1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1X', '1X'])
    const result = validateForMSystemExport(selections)
    expect(result.isValid).toBe(true)
  })

  it('rejects empty selections', () => {
    const result = validateForMSystemExport([])
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('No selections to export')
  })

  it('rejects wrong number of selections', () => {
    const selections = create13Selections(['1']).slice(0, 10)
    const result = validateForMSystemExport(selections)
    expect(result.isValid).toBe(false)
    expect(result.errors[0]).toContain('Expected 13 selections')
  })

  it('rejects single row (should use Enkelrader)', () => {
    // All single selections = 1 row
    const selections = create13Selections(['1'])
    const result = validateForMSystemExport(selections)
    expect(result.isValid).toBe(false)
    expect(result.errors[0]).toContain('at least 2 rows')
  })

  it('rejects more than 41,472 rows', () => {
    // 3^13 = 1,594,323 rows (all full coverage)
    const selections = create13Selections(['1X2'])
    const result = validateForMSystemExport(selections)
    expect(result.isValid).toBe(false)
    expect(result.errors[0]).toContain('Maximum for M-system')
  })
})

// ============================================================================
// getSelectionLength Tests
// ============================================================================

describe('getSelectionLength', () => {
  it('returns 1 for single outcomes', () => {
    expect(getSelectionLength('1')).toBe(1)
    expect(getSelectionLength('X')).toBe(1)
    expect(getSelectionLength('2')).toBe(1)
  })

  it('returns 2 for double outcomes', () => {
    expect(getSelectionLength('1X')).toBe(2)
    expect(getSelectionLength('X2')).toBe(2)
    expect(getSelectionLength('12')).toBe(2)
  })

  it('returns 3 for full coverage', () => {
    expect(getSelectionLength('1X2')).toBe(3)
  })

  it('handles lowercase', () => {
    expect(getSelectionLength('x')).toBe(1)
    expect(getSelectionLength('1x')).toBe(2)
    expect(getSelectionLength('1x2')).toBe(3)
  })
})

// ============================================================================
// calculateMSystemRowCount Tests
// ============================================================================

describe('calculateMSystemRowCount', () => {
  it('returns 1 for all single selections (13 spiks)', () => {
    const selections = create13Selections(['1'])
    expect(calculateMSystemRowCount(selections)).toBe(1)
  })

  it('returns correct count with one halvgardering (2)', () => {
    // 12 singles + 1 double = 1 * 2 = 2 rows
    const selections = [
      ...Array.from({ length: 12 }, (_, i) => createSelection(i + 1, '1')),
      createSelection(13, '1X'),
    ]
    expect(calculateMSystemRowCount(selections)).toBe(2)
  })

  it('returns correct count with multiple hedges', () => {
    // 10 singles + 2 doubles + 1 triple = 1 * 2 * 2 * 3 = 12 rows
    const selections = [
      ...Array.from({ length: 10 }, (_, i) => createSelection(i + 1, '1')),
      createSelection(11, '1X'),
      createSelection(12, 'X2'),
      createSelection(13, '1X2'),
    ]
    expect(calculateMSystemRowCount(selections)).toBe(12)
  })

  it('returns 0 for empty selections', () => {
    expect(calculateMSystemRowCount([])).toBe(0)
  })

  it('calculates exponentially for multiple full coverage', () => {
    // 3 triples + 10 singles = 3^3 * 1^10 = 27 rows
    const selections = [
      createSelection(1, '1X2'),
      createSelection(2, '1X2'),
      createSelection(3, '1X2'),
      ...Array.from({ length: 10 }, (_, i) => createSelection(i + 4, '1')),
    ]
    expect(calculateMSystemRowCount(selections)).toBe(27)
  })
})

// ============================================================================
// generateEnkelraderContent Tests
// ============================================================================

describe('generateEnkelraderContent', () => {
  it('generates correct E-format for single row', () => {
    const rows = [createValidRow(1)]
    const content = generateEnkelraderContent(rows)
    expect(content).toBe('E,1,X,2,1,1,X,2,1,X,2,1,1,2')
  })

  it('generates multiple lines for multiple rows', () => {
    const rows = [
      createValidRow(1, ['1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1']),
      createValidRow(2, ['2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2']),
    ]
    const content = generateEnkelraderContent(rows)
    const lines = content.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('E,1,1,1,1,1,1,1,1,1,1,1,1,1')
    expect(lines[1]).toBe('E,2,2,2,2,2,2,2,2,2,2,2,2,2')
  })

  it('normalizes lowercase to uppercase', () => {
    const rows = [createValidRow(1, ['1', 'x', '2', '1', '1', 'x', '2', '1', 'x', '2', '1', '1', '2'])]
    const content = generateEnkelraderContent(rows)
    expect(content).toBe('E,1,X,2,1,1,X,2,1,X,2,1,1,2')
  })

  it('returns empty string for empty rows', () => {
    expect(generateEnkelraderContent([])).toBe('')
  })
})

// ============================================================================
// generateMSystemContent Tests
// ============================================================================

describe('generateMSystemContent', () => {
  it('generates correct M-format with row count', () => {
    const selections = [
      ...Array.from({ length: 12 }, (_, i) => createSelection(i + 1, '1')),
      createSelection(13, '1X'),
    ]
    const content = generateMSystemContent(selections)
    expect(content).toMatch(/^M2,/) // 2 rows
    expect(content).toContain('1X')
  })

  it('sorts selections by match number', () => {
    // Create selections in wrong order
    const selections = [
      createSelection(13, '1X2'),
      createSelection(1, '1'),
      createSelection(7, 'X'),
      ...Array.from({ length: 10 }, (_, i) =>
        createSelection([2, 3, 4, 5, 6, 8, 9, 10, 11, 12][i], '1')
      ),
    ]
    const content = generateMSystemContent(selections)
    // Should start with selection for match 1
    expect(content).toMatch(/^M\d+,1,/) // Match 1 is "1"
  })

  it('normalizes selections to uppercase', () => {
    const selections = [
      ...Array.from({ length: 12 }, (_, i) => createSelection(i + 1, '1')),
      createSelection(13, '1x'),
    ]
    const content = generateMSystemContent(selections)
    expect(content).toContain('1X') // Should be uppercase
    expect(content).not.toContain('1x')
  })
})

// ============================================================================
// generateExportFilename Tests
// ============================================================================

describe('generateExportFilename', () => {
  it('generates correct filename with system ID', () => {
    const filename = generateExportFilename(2849, 'R-4-0-9-12', 'enkelrader')
    expect(filename).toBe('stryktipset-2849-R-4-0-9-12-enkelrader.txt')
  })

  it('generates correct filename for M-system format', () => {
    const filename = generateExportFilename(2849, 'R-4-0-9-12', 'msystem')
    expect(filename).toBe('stryktipset-2849-R-4-0-9-12-msystem.txt')
  })

  it('uses "ai" when system ID is undefined', () => {
    const filename = generateExportFilename(2849, undefined, 'enkelrader')
    expect(filename).toBe('stryktipset-2849-ai-enkelrader.txt')
  })

  it('handles U-system IDs', () => {
    const filename = generateExportFilename(2850, 'U-custom', 'msystem')
    expect(filename).toBe('stryktipset-2850-U-custom-msystem.txt')
  })
})
