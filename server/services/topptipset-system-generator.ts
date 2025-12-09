import type { BettingSystem, CouponRow, HedgeAssignment } from '~/types'

/**
 * Topptipset System Generator
 *
 * Generates reduced betting systems for Topptipset (8 matches).
 * Unlike Stryktipset/Europatipset which have official Svenska Spel R-systems,
 * Topptipset requires custom system generation using covering code theory.
 *
 * Key differences from 13-match games:
 * - 8 matches instead of 13
 * - Full space: 3^8 = 6,561 combinations (vs 3^13 = 1,594,323)
 * - No official R-systems from Svenska Spel
 * - Variable stake options: 1, 2, 5, 10 SEK per row
 * - 70% payout rate (vs 65% for Stryktipset)
 * - All-or-nothing: only 8 rätt wins (no consolation prizes)
 */
export class TopptipsetSystemGenerator {
  private keyRowsCache: Map<string, number[][]> = new Map()

  /**
   * Generate a reduced system for Topptipset
   *
   * @param helg - Number of helgarderingar (full hedges, 3 outcomes)
   * @param halvg - Number of halvgarderingar (half hedges, 2 outcomes)
   * @param targetRows - Target number of rows (optional, auto-calculated if not provided)
   * @param guarantee - Guarantee level (8 = full, 7 = one error tolerance, etc.)
   */
  generateSystem(
    helg: number,
    halvg: number,
    targetRows?: number,
    guarantee: number = 8
  ): BettingSystem {
    // Validate inputs
    const totalHedged = helg + halvg
    if (totalHedged > 8) {
      throw new Error(`Total hedged matches (${totalHedged}) cannot exceed 8`)
    }

    // Calculate full system size
    const fullRows = Math.pow(3, helg) * Math.pow(2, halvg)

    // Auto-calculate target rows if not provided
    const rows = targetRows || this.calculateOptimalRows(helg, halvg, guarantee)

    // Ensure rows don't exceed full system
    const actualRows = Math.min(rows, fullRows)

    const systemId = `T-${helg}-${halvg}-${actualRows}-${guarantee}`

    return {
      id: systemId,
      type: 'R', // Topptipset systems are reduction systems
      helgarderingar: helg,
      halvgarderingar: halvg,
      rows: actualRows,
      guarantee,
    }
  }

  /**
   * Calculate optimal number of rows for a given guarantee level
   * Uses sphere packing lower bound
   */
  private calculateOptimalRows(helg: number, halvg: number, guarantee: number): number {
    const fullRows = Math.pow(3, helg) * Math.pow(2, halvg)
    const radius = 8 - guarantee

    if (radius === 0) {
      // Full guarantee (8 rätt): need all rows
      return fullRows
    }

    // Calculate sphere volume (coverage of one key row)
    const sphereVolume = this.calculateSphereVolume(helg + halvg, radius)

    // Lower bound: ceil(fullRows / sphereVolume)
    const lowerBound = Math.ceil(fullRows / sphereVolume)

    // Add 10% safety margin for greedy algorithm inefficiency
    return Math.min(Math.ceil(lowerBound * 1.1), fullRows)
  }

  /**
   * Calculate the volume of a Hamming sphere
   * V(n, r) = sum(i=0 to r) C(n, i) * (q-1)^i
   * where q = alphabet size (3 for helg, 2 for halvg - simplified to avg ~2.5)
   */
  private calculateSphereVolume(positions: number, radius: number): number {
    let volume = 0
    const avgAlphabetSize = 2.5 // Weighted average for mixed helg/halvg

    for (let i = 0; i <= radius; i++) {
      volume += this.binomial(positions, i) * Math.pow(avgAlphabetSize - 1, i)
    }

    return Math.ceil(volume)
  }

  /**
   * Calculate binomial coefficient C(n, k)
   */
  private binomial(n: number, k: number): number {
    if (k > n) return 0
    if (k === 0 || k === n) return 1

    let result = 1
    for (let i = 0; i < k; i++) {
      result = (result * (n - i)) / (i + 1)
    }
    return Math.round(result)
  }

  /**
   * Generate key rows for a Topptipset system using covering code algorithm
   */
  generateKeyRows(system: BettingSystem): number[][] {
    const cacheKey = system.id
    if (this.keyRowsCache.has(cacheKey)) {
      return this.keyRowsCache.get(cacheKey)!
    }

    console.log(`[Topptipset] Generating key rows for ${system.id}`)

    // Generate full mathematical system
    const fullSystem = this.generateFullSystem(system.helgarderingar, system.halvgarderingar)

    // If target rows equals full system, no reduction needed
    if (fullSystem.length <= system.rows) {
      this.keyRowsCache.set(cacheKey, fullSystem)
      return fullSystem
    }

    // Apply covering code reduction
    const radius = 8 - (system.guarantee || 8)
    const keyRows = this.coveringCodeReduction(fullSystem, system.rows, radius)

    this.keyRowsCache.set(cacheKey, keyRows)
    console.log(`[Topptipset] Generated ${keyRows.length} key rows for ${system.id}`)

    return keyRows
  }

  /**
   * Generate full mathematical system (3^helg x 2^halvg combinations)
   */
  private generateFullSystem(helg: number, halvg: number): number[][] {
    const fullSystem: number[][] = []
    const totalCombinations = Math.pow(3, helg) * Math.pow(2, halvg)

    for (let i = 0; i < totalCombinations; i++) {
      const row: number[] = []
      let remaining = i

      // Generate helgarderingar positions (ternary: 0, 1, 2)
      for (let j = 0; j < helg; j++) {
        row.push(remaining % 3)
        remaining = Math.floor(remaining / 3)
      }

      // Generate halvgarderingar positions (binary: 0, 1)
      for (let j = 0; j < halvg; j++) {
        row.push(remaining % 2)
        remaining = Math.floor(remaining / 2)
      }

      fullSystem.push(row)
    }

    return fullSystem
  }

  /**
   * Covering code reduction using greedy set cover algorithm
   */
  private coveringCodeReduction(
    fullSystem: number[][],
    targetRows: number,
    radius: number
  ): number[][] {
    if (fullSystem.length <= targetRows) {
      return fullSystem
    }

    const keyRows: number[][] = []
    const uncoveredRows = new Set<number>(fullSystem.map((_, idx) => idx))

    // Greedy selection: pick rows that cover the most uncovered combinations
    while (keyRows.length < targetRows && uncoveredRows.size > 0) {
      let bestRow: number[] | null = null
      let bestIdx = -1
      let bestCoverage = 0

      for (const idx of uncoveredRows) {
        const row = fullSystem[idx]!
        const coverage = this.countCoveredRows(row, fullSystem, uncoveredRows, radius)

        if (coverage > bestCoverage) {
          bestCoverage = coverage
          bestRow = row
          bestIdx = idx
        }
      }

      if (bestRow === null) break

      keyRows.push(bestRow)
      uncoveredRows.delete(bestIdx)

      // Mark covered rows
      const coveredIndices = this.getCoveredRowIndices(bestRow, fullSystem, uncoveredRows, radius)
      coveredIndices.forEach(idx => uncoveredRows.delete(idx))
    }

    // If we didn't get enough rows, add remaining uncovered rows
    while (keyRows.length < targetRows && uncoveredRows.size > 0) {
      const idx = Array.from(uncoveredRows)[0]!
      keyRows.push(fullSystem[idx]!)
      uncoveredRows.delete(idx)
    }

    return keyRows
  }

  /**
   * Count how many uncovered rows would be covered by adding this row
   */
  private countCoveredRows(
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

  /**
   * Get indices of all uncovered rows that would be covered by this row
   */
  private getCoveredRowIndices(
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

  /**
   * Calculate Hamming distance between two rows
   */
  private hammingDistance(row1: number[], row2: number[]): number {
    let distance = 0
    const len = Math.min(row1.length, row2.length)
    for (let i = 0; i < len; i++) {
      if (row1[i] !== row2[i]) {
        distance++
      }
    }
    return distance
  }

  /**
   * Apply system to match selections to generate actual coupon rows
   */
  applySystem(
    system: BettingSystem,
    hedgeAssignment: HedgeAssignment,
    utgangstecken?: Record<number, string>
  ): CouponRow[] {
    const keyRows = this.generateKeyRows(system)

    return keyRows.map((pattern, idx) => ({
      rowNumber: idx + 1,
      picks: this.mapPatternToOutcomes(pattern, hedgeAssignment, utgangstecken),
    }))
  }

  /**
   * Map numeric pattern to actual match outcomes for 8 matches
   */
  private mapPatternToOutcomes(
    pattern: number[],
    hedgeAssignment: HedgeAssignment,
    utgangstecken?: Record<number, string>
  ): string[] {
    const outcomes: string[] = new Array(8)
    let patternIdx = 0

    for (let matchNum = 1; matchNum <= 8; matchNum++) {
      if (hedgeAssignment.spiks.includes(matchNum)) {
        // Spik: use fixed outcome
        outcomes[matchNum - 1] = hedgeAssignment.spikOutcomes[matchNum] || '1'
      } else if (hedgeAssignment.helgarderingar.includes(matchNum)) {
        // Helgarderad: map 0='1', 1='X', 2='2'
        const value = pattern[patternIdx++] || 0
        outcomes[matchNum - 1] = ['1', 'X', '2'][value] || '1'
      } else if (hedgeAssignment.halvgarderingar.includes(matchNum)) {
        // Halvgarderad: map based on utgångstecken or default
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
        // Fallback to '1'
        outcomes[matchNum - 1] = '1'
      }
    }

    return outcomes
  }

  /**
   * Get complementary outcome for half hedge
   */
  private getComplementaryOutcome(outcome: string): string {
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

  /**
   * Get pre-computed common Topptipset systems
   */
  getCommonSystems(): BettingSystem[] {
    return [
      // Small budget systems (up to 100 SEK at 1 SEK/row)
      this.generateSystem(2, 0, 9, 8), // T-2-0-9-8: Full 2 helg
      this.generateSystem(3, 0, 27, 8), // T-3-0-27-8: Full 3 helg
      this.generateSystem(2, 2, 36, 8), // T-2-2-36-8: Full 2 helg + 2 halvg

      // Medium budget systems (100-500 SEK)
      this.generateSystem(4, 0, 81, 8), // T-4-0-81-8: Full 4 helg
      this.generateSystem(3, 2, 108, 8), // T-3-2-108-8: Full 3 helg + 2 halvg
      this.generateSystem(4, 1, 162, 8), // T-4-1-162-8: Full 4 helg + 1 halvg

      // Reduced systems with guarantee
      this.generateSystem(4, 0, 27, 7), // T-4-0-27-7: 4 helg, 27 rows, 7 rätt guarantee
      this.generateSystem(5, 0, 81, 7), // T-5-0-81-7: 5 helg, 81 rows, 7 rätt guarantee
      this.generateSystem(6, 0, 81, 6), // T-6-0-81-6: 6 helg, 81 rows, 6 rätt guarantee

      // Large budget systems
      this.generateSystem(5, 0, 243, 8), // T-5-0-243-8: Full 5 helg
      this.generateSystem(4, 2, 324, 8), // T-4-2-324-8: Full 4 helg + 2 halvg
      this.generateSystem(6, 0, 243, 7), // T-6-0-243-7: 6 helg reduced
    ]
  }

  /**
   * Calculate cost based on rows and stake
   */
  calculateCost(rows: number, stake: number = 1): number {
    const validStakes = [1, 2, 5, 10]
    if (!validStakes.includes(stake)) {
      throw new Error(`Invalid stake: ${stake}. Must be one of: ${validStakes.join(', ')}`)
    }
    return rows * stake
  }

  /**
   * Get system recommendations based on budget
   */
  getRecommendedSystems(budget: number, stake: number = 1): BettingSystem[] {
    const maxRows = Math.floor(budget / stake)
    return this.getCommonSystems().filter(s => s.rows <= maxRows)
  }
}

// Export singleton instance
export const topptipsetSystemGenerator = new TopptipsetSystemGenerator()
