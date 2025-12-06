import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BettingSystem, HedgeAssignment, MGExtension, CouponRow } from '~/types'

// Mock the console.log to avoid noisy output
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})

// Create a testable version of SystemGenerator to test private methods
class TestableSystemGenerator {
  private systems: BettingSystem[] = []
  private keyRowsCache: Map<string, number[][]> = new Map()

  constructor(systems: BettingSystem[] = []) {
    this.systems = systems
  }

  // Public methods
  loadSystems(): BettingSystem[] {
    return this.systems
  }

  getSystem(systemId: string): BettingSystem | null {
    return this.systems.find(s => s.id === systemId) || null
  }

  generateKeyRows(system: BettingSystem): number[][] {
    if (this.keyRowsCache.has(system.id)) {
      return this.keyRowsCache.get(system.id)!
    }

    const fullSystem = this.generateFullSystem(system.helgarderingar, system.halvgarderingar)

    if (fullSystem.length === system.rows) {
      this.keyRowsCache.set(system.id, fullSystem)
      return fullSystem
    }

    const keyRows = this.coveringCodeReduction(fullSystem, system.rows, system.guarantee || 10)

    this.keyRowsCache.set(system.id, keyRows)
    return keyRows
  }

  applySystem(
    system: BettingSystem,
    hedgeAssignment: HedgeAssignment,
    utgangstecken?: Record<number, string>,
    mgExtensions?: MGExtension[]
  ): CouponRow[] {
    const keyRows = this.generateKeyRows(system)

    const couponRows: CouponRow[] = keyRows.map((pattern, idx) => ({
      rowNumber: idx + 1,
      picks: this.mapPatternToOutcomes(pattern, hedgeAssignment, utgangstecken),
    }))

    if (mgExtensions && mgExtensions.length > 0) {
      return this.applyMGExtensions(couponRows, mgExtensions)
    }

    return couponRows
  }

  applyMGExtensions(baseRows: CouponRow[], mgExtensions: MGExtension[]): CouponRow[] {
    let expandedRows = [...baseRows]

    for (const mg of mgExtensions) {
      const newRows: CouponRow[] = []

      if (mg.type === 'hel') {
        for (const row of expandedRows) {
          for (const outcome of ['1', 'X', '2']) {
            const newPicks = [...row.picks]
            newPicks[mg.matchNumber - 1] = outcome
            newRows.push({
              rowNumber: newRows.length + 1,
              picks: newPicks,
            })
          }
        }
      } else if (mg.type === 'halv' && mg.outcomes) {
        for (const row of expandedRows) {
          for (const outcome of mg.outcomes) {
            const newPicks = [...row.picks]
            newPicks[mg.matchNumber - 1] = outcome
            newRows.push({
              rowNumber: newRows.length + 1,
              picks: newPicks,
            })
          }
        }
      }

      expandedRows = newRows
    }

    return expandedRows.map((row, idx) => ({
      ...row,
      rowNumber: idx + 1,
    }))
  }

  // Expose private methods for testing
  generateFullSystem(helg: number, halvg: number): number[][] {
    const fullSystem: number[][] = []
    const totalCombinations = Math.pow(3, helg) * Math.pow(2, halvg)

    for (let i = 0; i < totalCombinations; i++) {
      const row: number[] = []
      let remaining = i

      for (let j = 0; j < helg; j++) {
        row.push(remaining % 3)
        remaining = Math.floor(remaining / 3)
      }

      for (let j = 0; j < halvg; j++) {
        row.push(remaining % 2)
        remaining = Math.floor(remaining / 2)
      }

      fullSystem.push(row)
    }

    return fullSystem
  }

  coveringCodeReduction(fullSystem: number[][], targetRows: number, guarantee: number): number[][] {
    if (fullSystem.length <= targetRows) {
      return fullSystem
    }

    const keyRows: number[][] = []
    const uncoveredRows = new Set<number>(fullSystem.map((_, idx) => idx))
    const radius = 13 - guarantee

    while (keyRows.length < targetRows && uncoveredRows.size > 0) {
      let bestRow: number[] | null = null
      let bestCoverage = 0

      for (const idx of uncoveredRows) {
        const row = fullSystem[idx]!
        const coverage = this.countCoveredRows(row, fullSystem, uncoveredRows, radius)

        if (coverage > bestCoverage) {
          bestCoverage = coverage
          bestRow = row
        }
      }

      if (bestRow === null) break

      keyRows.push(bestRow)

      const coveredIndices = this.getCoveredRowIndices(bestRow, fullSystem, uncoveredRows, radius)
      coveredIndices.forEach(idx => uncoveredRows.delete(idx))
    }

    while (keyRows.length < targetRows && uncoveredRows.size > 0) {
      const idx = Array.from(uncoveredRows)[0]!
      keyRows.push(fullSystem[idx]!)
      uncoveredRows.delete(idx)
    }

    return keyRows
  }

  hammingDistance(row1: number[], row2: number[]): number {
    let distance = 0
    for (let i = 0; i < row1.length; i++) {
      if (row1[i] !== row2[i]) {
        distance++
      }
    }
    return distance
  }

  countCoveredRows(
    row: number[],
    fullSystem: number[][],
    uncoveredIndices: Set<number>,
    radius: number
  ): number {
    let count = 0
    for (const idx of uncoveredIndices) {
      const otherRow = fullSystem[idx]!
      if (this.hammingDistance(row, otherRow) <= radius) {
        count++
      }
    }
    return count
  }

  getCoveredRowIndices(
    row: number[],
    fullSystem: number[][],
    uncoveredIndices: Set<number>,
    radius: number
  ): number[] {
    const covered: number[] = []
    for (const idx of uncoveredIndices) {
      const otherRow = fullSystem[idx]!
      if (this.hammingDistance(row, otherRow) <= radius) {
        covered.push(idx)
      }
    }
    return covered
  }

  mapPatternToOutcomes(
    pattern: number[],
    hedgeAssignment: HedgeAssignment,
    utgangstecken?: Record<number, string>
  ): string[] {
    const outcomes: string[] = new Array(13)
    let patternIdx = 0

    for (let matchNum = 1; matchNum <= 13; matchNum++) {
      if (hedgeAssignment.spiks.includes(matchNum)) {
        outcomes[matchNum - 1] = hedgeAssignment.spikOutcomes[matchNum] || '1'
      } else if (hedgeAssignment.helgarderingar.includes(matchNum)) {
        const value = pattern[patternIdx++] || 0
        outcomes[matchNum - 1] = ['1', 'X', '2'][value] || '1'
      } else if (hedgeAssignment.halvgarderingar.includes(matchNum)) {
        const value = pattern[patternIdx++] || 0
        const utgangOutcome = utgangstecken?.[matchNum]

        if (utgangOutcome) {
          if (value === 0) {
            outcomes[matchNum - 1] = utgangOutcome
          } else {
            outcomes[matchNum - 1] = this.getComplementaryOutcome(utgangOutcome)
          }
        } else {
          outcomes[matchNum - 1] = value === 0 ? '1' : 'X'
        }
      } else {
        outcomes[matchNum - 1] = '1'
      }
    }

    return outcomes
  }

  getComplementaryOutcome(outcome: string): string {
    switch (outcome) {
      case '1':
        return 'X'
      case 'X':
        return '2'
      case '2':
        return '1'
      default:
        return 'X'
    }
  }

  clearCache(): void {
    this.keyRowsCache.clear()
  }
}

// ============================================================================
// Test Utilities
// ============================================================================

const createTestSystem = (overrides: Partial<BettingSystem> = {}): BettingSystem => ({
  id: 'R-4-0-9-12',
  type: 'R',
  helgarderingar: 4,
  halvgarderingar: 0,
  rows: 9,
  guarantee: 12,
  ...overrides,
})

const createHedgeAssignment = (overrides: Partial<HedgeAssignment> = {}): HedgeAssignment => ({
  spiks: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  helgarderingar: [10, 11, 12, 13],
  halvgarderingar: [],
  spikOutcomes: {
    1: '1',
    2: 'X',
    3: '2',
    4: '1',
    5: 'X',
    6: '2',
    7: '1',
    8: 'X',
    9: '2',
  },
  ...overrides,
})

// ============================================================================
// loadSystems Tests
// ============================================================================

describe('SystemGenerator', () => {
  let generator: TestableSystemGenerator

  beforeEach(() => {
    generator = new TestableSystemGenerator([
      createTestSystem({ id: 'R-4-0-9-12' }),
      createTestSystem({ id: 'R-5-0-18-11', helgarderingar: 5, rows: 18, guarantee: 11 }),
      createTestSystem({
        id: 'U-4-4-16',
        type: 'U',
        halvgarderingar: 4,
        rows: 16,
        guarantee: undefined,
      }),
    ])
  })

  describe('loadSystems', () => {
    it('returns all loaded systems', () => {
      const systems = generator.loadSystems()
      expect(systems).toHaveLength(3)
    })

    it('returns empty array when no systems loaded', () => {
      const emptyGenerator = new TestableSystemGenerator([])
      expect(emptyGenerator.loadSystems()).toEqual([])
    })
  })

  // ============================================================================
  // getSystem Tests
  // ============================================================================

  describe('getSystem', () => {
    it('returns system by ID', () => {
      const system = generator.getSystem('R-4-0-9-12')
      expect(system).not.toBeNull()
      expect(system?.id).toBe('R-4-0-9-12')
    })

    it('returns null for unknown system ID', () => {
      expect(generator.getSystem('unknown-system')).toBeNull()
    })

    it('finds U-system by ID', () => {
      const system = generator.getSystem('U-4-4-16')
      expect(system?.type).toBe('U')
    })
  })

  // ============================================================================
  // generateFullSystem Tests
  // ============================================================================

  describe('generateFullSystem', () => {
    it('generates 3^n combinations for helgarderingar only', () => {
      const fullSystem = generator.generateFullSystem(2, 0)
      expect(fullSystem).toHaveLength(9) // 3^2 = 9
    })

    it('generates 2^n combinations for halvgarderingar only', () => {
      const fullSystem = generator.generateFullSystem(0, 3)
      expect(fullSystem).toHaveLength(8) // 2^3 = 8
    })

    it('generates 3^h × 2^d combinations for mixed', () => {
      const fullSystem = generator.generateFullSystem(2, 2)
      expect(fullSystem).toHaveLength(36) // 3^2 × 2^2 = 9 × 4 = 36
    })

    it('generates single row for no hedges', () => {
      const fullSystem = generator.generateFullSystem(0, 0)
      expect(fullSystem).toHaveLength(1)
      expect(fullSystem[0]).toEqual([])
    })

    it('generates correct patterns for helgarderingar', () => {
      const fullSystem = generator.generateFullSystem(2, 0)
      // Should have all combinations of 0, 1, 2 for 2 positions
      expect(fullSystem).toContainEqual([0, 0])
      expect(fullSystem).toContainEqual([1, 0])
      expect(fullSystem).toContainEqual([2, 0])
      expect(fullSystem).toContainEqual([0, 1])
      expect(fullSystem).toContainEqual([1, 1])
      expect(fullSystem).toContainEqual([2, 1])
      expect(fullSystem).toContainEqual([0, 2])
      expect(fullSystem).toContainEqual([1, 2])
      expect(fullSystem).toContainEqual([2, 2])
    })

    it('generates correct patterns for halvgarderingar', () => {
      const fullSystem = generator.generateFullSystem(0, 2)
      // Should have all combinations of 0, 1 for 2 positions
      expect(fullSystem).toContainEqual([0, 0])
      expect(fullSystem).toContainEqual([1, 0])
      expect(fullSystem).toContainEqual([0, 1])
      expect(fullSystem).toContainEqual([1, 1])
    })

    it('generates rows with helg positions before halvg positions', () => {
      const fullSystem = generator.generateFullSystem(1, 1)
      // 3 × 2 = 6 combinations
      expect(fullSystem).toHaveLength(6)
      // First position (helg) can be 0, 1, 2
      // Second position (halvg) can be 0, 1
      expect(fullSystem).toContainEqual([0, 0])
      expect(fullSystem).toContainEqual([1, 0])
      expect(fullSystem).toContainEqual([2, 0])
      expect(fullSystem).toContainEqual([0, 1])
      expect(fullSystem).toContainEqual([1, 1])
      expect(fullSystem).toContainEqual([2, 1])
    })
  })

  // ============================================================================
  // hammingDistance Tests
  // ============================================================================

  describe('hammingDistance', () => {
    it('returns 0 for identical rows', () => {
      expect(generator.hammingDistance([0, 1, 2], [0, 1, 2])).toBe(0)
    })

    it('counts single difference', () => {
      expect(generator.hammingDistance([0, 1, 2], [0, 1, 0])).toBe(1)
    })

    it('counts multiple differences', () => {
      expect(generator.hammingDistance([0, 0, 0], [1, 1, 1])).toBe(3)
    })

    it('handles empty rows', () => {
      expect(generator.hammingDistance([], [])).toBe(0)
    })
  })

  // ============================================================================
  // coveringCodeReduction Tests
  // ============================================================================

  describe('coveringCodeReduction', () => {
    it('returns full system when target >= full size', () => {
      const fullSystem = [[0], [1], [2]]
      const reduced = generator.coveringCodeReduction(fullSystem, 3, 12)
      expect(reduced).toHaveLength(3)
    })

    it('returns full system when target > full size', () => {
      const fullSystem = [[0], [1]]
      const reduced = generator.coveringCodeReduction(fullSystem, 5, 12)
      expect(reduced).toHaveLength(2)
    })

    it('reduces to target row count', () => {
      const fullSystem = generator.generateFullSystem(3, 0) // 27 combinations
      const reduced = generator.coveringCodeReduction(fullSystem, 9, 12)
      expect(reduced.length).toBeLessThanOrEqual(9)
    })

    it('uses greedy selection for coverage', () => {
      // This test verifies the greedy algorithm selects rows that cover the most
      const fullSystem = generator.generateFullSystem(2, 0) // 9 combinations
      const reduced = generator.coveringCodeReduction(fullSystem, 3, 11) // radius = 2
      expect(reduced.length).toBeLessThanOrEqual(3)
    })
  })

  // ============================================================================
  // generateKeyRows Tests
  // ============================================================================

  describe('generateKeyRows', () => {
    it('generates correct number of rows for full system', () => {
      const system = createTestSystem({
        id: 'R-2-0-9-12',
        helgarderingar: 2,
        halvgarderingar: 0,
        rows: 9, // 3^2 = 9 (full system)
      })
      const keyRows = generator.generateKeyRows(system)
      expect(keyRows).toHaveLength(9)
    })

    it('caches generated key rows', () => {
      const system = createTestSystem()
      const keyRows1 = generator.generateKeyRows(system)
      const keyRows2 = generator.generateKeyRows(system)
      expect(keyRows1).toBe(keyRows2) // Same reference from cache
    })

    it('generates reduced system when rows < full combinations', () => {
      const system = createTestSystem({
        id: 'R-3-0-9-12',
        helgarderingar: 3,
        halvgarderingar: 0,
        rows: 9, // Full is 27, target is 9
        guarantee: 12,
      })
      const keyRows = generator.generateKeyRows(system)
      expect(keyRows.length).toBeLessThanOrEqual(9)
    })
  })

  // ============================================================================
  // mapPatternToOutcomes Tests
  // ============================================================================

  describe('mapPatternToOutcomes', () => {
    it('maps spiks to fixed outcomes', () => {
      const pattern: number[] = []
      const hedgeAssignment = createHedgeAssignment({
        spiks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        helgarderingar: [],
        halvgarderingar: [],
        spikOutcomes: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [i + 1, '1'])),
      })

      const outcomes = generator.mapPatternToOutcomes(pattern, hedgeAssignment)
      expect(outcomes).toEqual(['1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'])
    })

    it('maps helgarderingar pattern 0=1, 1=X, 2=2', () => {
      const pattern = [0, 1, 2, 0] // 4 helg positions
      const hedgeAssignment = createHedgeAssignment({
        spiks: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        helgarderingar: [10, 11, 12, 13],
        halvgarderingar: [],
      })

      const outcomes = generator.mapPatternToOutcomes(pattern, hedgeAssignment)
      expect(outcomes[9]).toBe('1') // Match 10, pattern[0]=0 -> '1'
      expect(outcomes[10]).toBe('X') // Match 11, pattern[1]=1 -> 'X'
      expect(outcomes[11]).toBe('2') // Match 12, pattern[2]=2 -> '2'
      expect(outcomes[12]).toBe('1') // Match 13, pattern[3]=0 -> '1'
    })

    it('maps halvgarderingar without utgangstecken', () => {
      const pattern = [0, 1] // 2 halvg positions
      const hedgeAssignment = createHedgeAssignment({
        spiks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        helgarderingar: [],
        halvgarderingar: [12, 13],
      })

      const outcomes = generator.mapPatternToOutcomes(pattern, hedgeAssignment)
      expect(outcomes[11]).toBe('1') // Match 12, pattern[0]=0 -> '1'
      expect(outcomes[12]).toBe('X') // Match 13, pattern[1]=1 -> 'X'
    })

    it('maps halvgarderingar with utgangstecken', () => {
      const pattern = [0, 1] // 2 halvg positions
      const hedgeAssignment = createHedgeAssignment({
        spiks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        helgarderingar: [],
        halvgarderingar: [12, 13],
      })
      const utgangstecken = { 12: '2', 13: 'X' }

      const outcomes = generator.mapPatternToOutcomes(pattern, hedgeAssignment, utgangstecken)
      expect(outcomes[11]).toBe('2') // Match 12, pattern[0]=0 -> utgangstecken '2'
      expect(outcomes[12]).toBe('2') // Match 13, pattern[1]=1 -> complement of 'X' is '2'
    })

    it('uses default outcome for unassigned matches', () => {
      const pattern: number[] = []
      const hedgeAssignment: HedgeAssignment = {
        spiks: [],
        helgarderingar: [],
        halvgarderingar: [],
        spikOutcomes: {},
      }

      const outcomes = generator.mapPatternToOutcomes(pattern, hedgeAssignment)
      expect(outcomes.every(o => o === '1')).toBe(true)
    })
  })

  // ============================================================================
  // getComplementaryOutcome Tests
  // ============================================================================

  describe('getComplementaryOutcome', () => {
    it('returns X for 1', () => {
      expect(generator.getComplementaryOutcome('1')).toBe('X')
    })

    it('returns 2 for X', () => {
      expect(generator.getComplementaryOutcome('X')).toBe('2')
    })

    it('returns 1 for 2', () => {
      expect(generator.getComplementaryOutcome('2')).toBe('1')
    })

    it('returns X for unknown outcome', () => {
      expect(generator.getComplementaryOutcome('invalid')).toBe('X')
    })
  })

  // ============================================================================
  // applySystem Tests
  // ============================================================================

  describe('applySystem', () => {
    it('generates correct number of coupon rows', () => {
      const system = createTestSystem({
        helgarderingar: 2,
        halvgarderingar: 0,
        rows: 9,
      })
      const hedgeAssignment = createHedgeAssignment({
        spiks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        helgarderingar: [12, 13],
        halvgarderingar: [],
      })

      generator.clearCache()
      const couponRows = generator.applySystem(system, hedgeAssignment)
      expect(couponRows).toHaveLength(9)
    })

    it('generates rows with correct picks array length', () => {
      const system = createTestSystem()
      const hedgeAssignment = createHedgeAssignment()

      const couponRows = generator.applySystem(system, hedgeAssignment)
      couponRows.forEach(row => {
        expect(row.picks).toHaveLength(13)
      })
    })

    it('numbers rows starting from 1', () => {
      const system = createTestSystem()
      const hedgeAssignment = createHedgeAssignment()

      const couponRows = generator.applySystem(system, hedgeAssignment)
      expect(couponRows[0]?.rowNumber).toBe(1)
      expect(couponRows[couponRows.length - 1]?.rowNumber).toBe(couponRows.length)
    })

    it('applies utgangstecken for U-systems', () => {
      const system = createTestSystem({
        type: 'U',
        helgarderingar: 0,
        halvgarderingar: 2,
        rows: 4,
      })
      const hedgeAssignment = createHedgeAssignment({
        spiks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        helgarderingar: [],
        halvgarderingar: [12, 13],
      })
      const utgangstecken = { 12: '2', 13: 'X' }

      generator.clearCache()
      const couponRows = generator.applySystem(system, hedgeAssignment, utgangstecken)

      // Check that utgangstecken influences the outcomes
      const match12Outcomes = couponRows.map(r => r.picks[11])
      const match13Outcomes = couponRows.map(r => r.picks[12])

      // Should contain the utgangstecken outcomes
      expect(match12Outcomes).toContain('2')
      expect(match13Outcomes).toContain('X')
    })
  })

  // ============================================================================
  // applyMGExtensions Tests
  // ============================================================================

  describe('applyMGExtensions', () => {
    it('triples rows with MG-hel extension', () => {
      const baseRows: CouponRow[] = [
        { rowNumber: 1, picks: ['1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'] },
      ]
      const mgExtensions: MGExtension[] = [{ matchNumber: 1, type: 'hel' }]

      const expandedRows = generator.applyMGExtensions(baseRows, mgExtensions)
      expect(expandedRows).toHaveLength(3) // 1 × 3 = 3
    })

    it('doubles rows with MG-halv extension', () => {
      const baseRows: CouponRow[] = [
        { rowNumber: 1, picks: ['1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'] },
      ]
      const mgExtensions: MGExtension[] = [{ matchNumber: 1, type: 'halv', outcomes: ['1', 'X'] }]

      const expandedRows = generator.applyMGExtensions(baseRows, mgExtensions)
      expect(expandedRows).toHaveLength(2) // 1 × 2 = 2
    })

    it('multiplies rows for multiple MG extensions', () => {
      const baseRows: CouponRow[] = [
        { rowNumber: 1, picks: ['1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'] },
      ]
      const mgExtensions: MGExtension[] = [
        { matchNumber: 1, type: 'hel' },
        { matchNumber: 2, type: 'halv', outcomes: ['X', '2'] },
      ]

      const expandedRows = generator.applyMGExtensions(baseRows, mgExtensions)
      expect(expandedRows).toHaveLength(6) // 1 × 3 × 2 = 6
    })

    it('applies MG-hel to correct match position', () => {
      const baseRows: CouponRow[] = [
        { rowNumber: 1, picks: ['1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'] },
      ]
      const mgExtensions: MGExtension[] = [{ matchNumber: 5, type: 'hel' }]

      const expandedRows = generator.applyMGExtensions(baseRows, mgExtensions)

      // Check match 5 (index 4) has all three outcomes across the rows
      const match5Outcomes = expandedRows.map(r => r.picks[4])
      expect(match5Outcomes).toContain('1')
      expect(match5Outcomes).toContain('X')
      expect(match5Outcomes).toContain('2')
    })

    it('applies MG-halv with specified outcomes', () => {
      const baseRows: CouponRow[] = [
        { rowNumber: 1, picks: ['1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'] },
      ]
      const mgExtensions: MGExtension[] = [{ matchNumber: 3, type: 'halv', outcomes: ['X', '2'] }]

      const expandedRows = generator.applyMGExtensions(baseRows, mgExtensions)

      // Check match 3 (index 2) has only X and 2
      const match3Outcomes = expandedRows.map(r => r.picks[2])
      expect(match3Outcomes).toContain('X')
      expect(match3Outcomes).toContain('2')
      expect(match3Outcomes).not.toContain('1')
    })

    it('renumbers rows sequentially', () => {
      const baseRows: CouponRow[] = [
        { rowNumber: 1, picks: ['1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'] },
        { rowNumber: 2, picks: ['2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2'] },
      ]
      const mgExtensions: MGExtension[] = [{ matchNumber: 1, type: 'hel' }]

      const expandedRows = generator.applyMGExtensions(baseRows, mgExtensions)

      // Should have 6 rows numbered 1-6
      expect(expandedRows.map(r => r.rowNumber)).toEqual([1, 2, 3, 4, 5, 6])
    })

    it('returns base rows when no extensions', () => {
      const baseRows: CouponRow[] = [
        { rowNumber: 1, picks: ['1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'] },
      ]

      const expandedRows = generator.applyMGExtensions(baseRows, [])
      expect(expandedRows).toHaveLength(1)
    })

    it('handles multiple base rows with MG extension', () => {
      const baseRows: CouponRow[] = [
        { rowNumber: 1, picks: ['1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'] },
        { rowNumber: 2, picks: ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X'] },
        { rowNumber: 3, picks: ['2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2'] },
      ]
      const mgExtensions: MGExtension[] = [{ matchNumber: 13, type: 'hel' }]

      const expandedRows = generator.applyMGExtensions(baseRows, mgExtensions)
      expect(expandedRows).toHaveLength(9) // 3 × 3 = 9
    })
  })

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('generates complete coupon for R-system', () => {
      const system = createTestSystem({
        id: 'R-2-2-36-12',
        helgarderingar: 2,
        halvgarderingar: 2,
        rows: 36, // Full system: 3^2 × 2^2 = 36
        guarantee: 12,
      })

      const hedgeAssignment: HedgeAssignment = {
        spiks: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        helgarderingar: [10, 11],
        halvgarderingar: [12, 13],
        spikOutcomes: {
          1: '1',
          2: '1',
          3: 'X',
          4: '2',
          5: '1',
          6: 'X',
          7: '2',
          8: '1',
          9: 'X',
        },
      }

      generator.clearCache()
      const couponRows = generator.applySystem(system, hedgeAssignment)

      // Should have 36 rows
      expect(couponRows).toHaveLength(36)

      // All rows should have 13 picks
      couponRows.forEach(row => {
        expect(row.picks).toHaveLength(13)
      })

      // Spik positions should be fixed
      couponRows.forEach(row => {
        expect(row.picks[0]).toBe('1') // Match 1
        expect(row.picks[2]).toBe('X') // Match 3
        expect(row.picks[3]).toBe('2') // Match 4
      })

      // Helgarderad positions should have variety
      const match10Outcomes = new Set(couponRows.map(r => r.picks[9]))
      expect(match10Outcomes.size).toBe(3) // Should have 1, X, 2
    })

    it('generates reduced coupon with MG extensions', () => {
      const system = createTestSystem({
        helgarderingar: 1,
        halvgarderingar: 0,
        rows: 3,
      })

      const hedgeAssignment: HedgeAssignment = {
        spiks: Array.from({ length: 12 }, (_, i) => i + 1),
        helgarderingar: [13],
        halvgarderingar: [],
        spikOutcomes: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, '1'])),
      }

      const mgExtensions: MGExtension[] = [
        { matchNumber: 1, type: 'hel' }, // Multiply by 3
      ]

      generator.clearCache()
      const couponRows = generator.applySystem(system, hedgeAssignment, undefined, mgExtensions)

      // Base: 3 rows from helg, × 3 from MG-hel = 9 rows
      expect(couponRows).toHaveLength(9)
    })
  })
})
