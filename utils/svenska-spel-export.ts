/**
 * Svenska Spel "Egna Rader" File Export Utilities
 *
 * Generates files in the official Svenska Spel upload format for Stryktipset.
 * Supports both Enkelrader (E-format) and M-system (compact) formats.
 *
 * @see https://spela.svenskaspel.se/stryktipset/externa-systemspel
 */

import type { CouponRow, CouponSelection } from '~/types'

// ============================================================================
// Types
// ============================================================================

export type ExportFormat = 'enkelrader' | 'msystem'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

// ============================================================================
// Constants
// ============================================================================

/** Valid single outcomes for Enkelrader format */
const VALID_SINGLE_OUTCOMES = ['1', 'X', '2']

/** Valid multi-outcome selections for M-system format */
const VALID_SELECTIONS = ['1', 'X', '2', '1X', 'X2', '12', '1X2']

/** Maximum rows per file for Enkelrader format */
const MAX_ENKELRADER_ROWS = 50000

/** Maximum row count for M-system (per Svenska Spel specification) */
const MAX_MSYSTEM_ROWS = 41472

/** Minimum row count for M-system (single row should use Enkelrader) */
const MIN_MSYSTEM_ROWS = 2

/** Number of matches in Stryktipset */
const MATCH_COUNT = 13

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a single coupon row for Enkelrader export
 */
export function validateCouponRow(row: CouponRow): { valid: boolean, error?: string } {
  if (row.picks.length !== MATCH_COUNT) {
    return {
      valid: false,
      error: `Row ${row.rowNumber}: Expected ${MATCH_COUNT} outcomes, got ${row.picks.length}`,
    }
  }

  for (let i = 0; i < row.picks.length; i++) {
    const pick = row.picks[i]?.toUpperCase()
    if (!pick || !VALID_SINGLE_OUTCOMES.includes(pick)) {
      return {
        valid: false,
        error: `Row ${row.rowNumber}, Match ${i + 1}: Invalid outcome "${row.picks[i]}", must be 1, X, or 2`,
      }
    }
  }

  return { valid: true }
}

/**
 * Validate all coupon rows for Enkelrader export
 */
export function validateForEnkelraderExport(rows: CouponRow[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (rows.length === 0) {
    errors.push('No rows to export')
    return { isValid: false, errors, warnings }
  }

  if (rows.length > MAX_ENKELRADER_ROWS) {
    errors.push(`Too many rows (${rows.length}). Maximum is ${MAX_ENKELRADER_ROWS.toLocaleString()} for Enkelrader format.`)
  }

  for (const row of rows) {
    const result = validateCouponRow(row)
    if (!result.valid && result.error) {
      errors.push(result.error)
    }
  }

  // Check for duplicate rows (warning only)
  const rowSignatures = new Set<string>()
  for (const row of rows) {
    const signature = row.picks.map(p => p.toUpperCase()).join(',')
    if (rowSignatures.has(signature)) {
      warnings.push(`Duplicate row detected: ${signature}`)
    }
    rowSignatures.add(signature)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate a single selection for M-system export
 */
export function validateSelection(selection: string, matchNumber: number): { valid: boolean, error?: string } {
  const normalized = selection.toUpperCase()
  if (!VALID_SELECTIONS.includes(normalized)) {
    return {
      valid: false,
      error: `Match ${matchNumber}: Invalid selection "${selection}", must be one of: ${VALID_SELECTIONS.join(', ')}`,
    }
  }
  return { valid: true }
}

/**
 * Validate selections for M-system export
 */
export function validateForMSystemExport(selections: CouponSelection[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!selections || selections.length === 0) {
    errors.push('No selections to export')
    return { isValid: false, errors, warnings }
  }

  if (selections.length !== MATCH_COUNT) {
    errors.push(`Expected ${MATCH_COUNT} selections, got ${selections.length}`)
  }

  // Validate each selection
  for (const sel of selections) {
    const result = validateSelection(sel.selection, sel.matchNumber)
    if (!result.valid && result.error) {
      errors.push(result.error)
    }
  }

  // Validate row count
  const rowCount = calculateMSystemRowCount(selections)

  if (rowCount < MIN_MSYSTEM_ROWS) {
    errors.push(`Row count is ${rowCount}. M-system requires at least ${MIN_MSYSTEM_ROWS} rows. Use Enkelrader format instead.`)
  }

  if (rowCount > MAX_MSYSTEM_ROWS) {
    errors.push(`Row count is ${rowCount.toLocaleString()}. Maximum for M-system is ${MAX_MSYSTEM_ROWS.toLocaleString()}.`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Get the number of outcomes in a selection string
 * "1" → 1, "1X" → 2, "1X2" → 3
 */
export function getSelectionLength(selection: string): number {
  const normalized = selection.toUpperCase()

  // Handle single outcomes
  if (normalized === '1' || normalized === 'X' || normalized === '2') {
    return 1
  }

  // Handle double outcomes
  if (normalized === '1X' || normalized === 'X2' || normalized === '12') {
    return 2
  }

  // Handle full coverage
  if (normalized === '1X2') {
    return 3
  }

  // Fallback: count unique characters (for edge cases)
  return normalized.length
}

/**
 * Calculate the total number of rows for an M-system
 * Returns the mathematical product of all selection lengths
 */
export function calculateMSystemRowCount(selections: CouponSelection[]): number {
  if (!selections || selections.length === 0) {
    return 0
  }

  return selections.reduce((total, sel) => {
    return total * getSelectionLength(sel.selection)
  }, 1)
}

// ============================================================================
// Content Generation Functions
// ============================================================================

/**
 * Generate Svenska Spel Enkelrader format content
 *
 * Format: E,{outcome1},{outcome2},...,{outcome13}
 * Example: E,1,1,1,1,2,1,2,1,1,X,1,2,1
 */
export function generateEnkelraderContent(rows: CouponRow[]): string {
  const lines: string[] = []

  for (const row of rows) {
    // Normalize to uppercase
    const normalizedPicks = row.picks.map(pick => pick.toUpperCase())
    lines.push(`E,${normalizedPicks.join(',')}`)
  }

  return lines.join('\n')
}

/**
 * Generate Svenska Spel M-system format content
 *
 * Format: M{rowCount},{selection1},{selection2},...,{selection13}
 * Example: M96,1X,2,1X,2,12,2,1X2,1,1,2,1,1X,12
 */
export function generateMSystemContent(selections: CouponSelection[]): string {
  // Sort selections by match number to ensure correct order
  const sortedSelections = [...selections].sort((a, b) => a.matchNumber - b.matchNumber)

  const rowCount = calculateMSystemRowCount(sortedSelections)
  const selectionStrings = sortedSelections.map(sel => sel.selection.toUpperCase())

  return `M${rowCount},${selectionStrings.join(',')}`
}

// ============================================================================
// File Handling Functions
// ============================================================================

/**
 * Generate filename for Svenska Spel export
 *
 * Format: stryktipset-{drawNumber}-{systemId}-{format}.txt
 * Example: stryktipset-2849-R-4-0-9-12-enkelrader.txt
 */
export function generateExportFilename(
  drawNumber: number,
  systemId: string | undefined,
  format: ExportFormat,
): string {
  const systemPart = systemId || 'ai'
  return `stryktipset-${drawNumber}-${systemPart}-${format}.txt`
}

/**
 * Download content as a text file in the browser
 */
export function downloadAsTextFile(content: string, filename: string): void {
  // Use ASCII-compatible encoding as per Svenska Spel specification
  const blob = new Blob([content], { type: 'text/plain;charset=ascii' })
  const url = window.URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  window.URL.revokeObjectURL(url)
}
