import { prisma } from '~/server/utils/prisma'
import bettingSystems from '~/server/constants/betting-systems.json'
import type {
  BettingSystem,
  CouponRow,
  CouponSelection,
  HedgeAssignment,
  MGExtension,
} from '~/types'

/**
 * Service for generating and managing betting systems (R and U-systems)
 *
 * Key rows are loaded from the database (Supabase) instead of static JSON files
 * to reduce bundle size and improve deployment performance.
 */
export class SystemGenerator {
  private systems: BettingSystem[] = []
  private keyRowsCache: Map<string, number[][]> = new Map()
  private loadingPromises: Map<string, Promise<number[][]>> = new Map()

  constructor() {
    this.loadSystemsFromJSON()
  }

  /**
   * Load all systems from JSON configuration
   */
  private loadSystemsFromJSON(): void {
    this.systems = [
      ...(bettingSystems['R-systems'] as BettingSystem[]),
      ...(bettingSystems['U-systems'] as BettingSystem[]),
    ]
    console.log(`[SystemGenerator] Loaded ${this.systems.length} betting systems`)
  }

  /**
   * Get all available systems
   */
  loadSystems(): BettingSystem[] {
    return this.systems
  }

  /**
   * Get specific system by ID
   */
  getSystem(systemId: string): BettingSystem | null {
    return this.systems.find(s => s.id === systemId) || null
  }

  /**
   * Generate key rows for a system - loads from database asynchronously
   */
  async generateKeyRows(system: BettingSystem): Promise<number[][]> {
    // Check cache first
    if (this.keyRowsCache.has(system.id)) {
      return this.keyRowsCache.get(system.id)!
    }

    // Prevent duplicate concurrent queries for the same system
    if (this.loadingPromises.has(system.id)) {
      return this.loadingPromises.get(system.id)!
    }

    const loadPromise = this.loadKeyRowsFromDatabase(system.id)
    this.loadingPromises.set(system.id, loadPromise)

    try {
      const keyRows = await loadPromise
      this.keyRowsCache.set(system.id, keyRows)
      return keyRows
    } finally {
      this.loadingPromises.delete(system.id)
    }
  }

  /**
   * Load key rows from Supabase database
   */
  private async loadKeyRowsFromDatabase(systemId: string): Promise<number[][]> {
    console.log(`[SystemGenerator] Loading key rows from DB for ${systemId}`)

    const rows = await prisma.system_key_rows.findMany({
      where: { system_id: systemId },
      orderBy: { row_index: 'asc' },
      select: { row_data: true },
    })

    if (rows.length === 0) {
      console.warn(
        `[SystemGenerator] No key rows found in DB for ${systemId}, using dynamic generation`
      )
      // Fallback to dynamic generation
      const system = this.getSystem(systemId)
      if (system) {
        return this.generateFullSystem(system.helgarderingar, system.halvgarderingar)
      }
      return []
    }

    console.log(`[SystemGenerator] Loaded ${rows.length} key rows for ${systemId}`)
    return rows.map(r => r.row_data as number[])
  }

  /**
   * Apply system to match selections to generate actual coupon rows
   * @param system - The betting system to apply
   * @param hedgeAssignment - The hedge assignment (spiks, helg, halvg)
   * @param utgangstecken - Optional utgångstecken for U-systems
   * @param mgExtensions - Optional MG extensions
   * @param matchCount - Number of matches (default: 13 for Stryktipset/Europatipset, use 8 for Topptipset)
   * @param selections - Optional selections array to get correct outcomes for halvgarderingar
   */
  async applySystem(
    system: BettingSystem,
    hedgeAssignment: HedgeAssignment,
    utgangstecken?: Record<number, string>,
    mgExtensions?: MGExtension[],
    matchCount: number = 13,
    selections?: CouponSelection[]
  ): Promise<CouponRow[]> {
    // Generate key rows for this system (now async)
    const keyRows = await this.generateKeyRows(system)

    // Map key rows to actual match outcomes
    const couponRows: CouponRow[] = keyRows.map((pattern, idx) => ({
      rowNumber: idx + 1,
      picks: this.mapPatternToOutcomes(
        pattern,
        hedgeAssignment,
        utgangstecken,
        matchCount,
        selections
      ),
    }))

    // Apply MG extensions if provided
    if (mgExtensions && mgExtensions.length > 0) {
      return this.applyMGExtensions(couponRows, mgExtensions)
    }

    return couponRows
  }

  /**
   * Apply matematiska garderingar (MG) extensions to expand a base system
   */
  applyMGExtensions(baseRows: CouponRow[], mgExtensions: MGExtension[]): CouponRow[] {
    let expandedRows = [...baseRows]

    for (const mg of mgExtensions) {
      const newRows: CouponRow[] = []

      if (mg.type === 'hel') {
        // MG-hel: multiply rows by 3 (add variants for 1, X, 2)
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
        // MG-halv: multiply rows by 2 (add variants for 2 specified outcomes)
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

    // Renumber rows
    return expandedRows.map((row, idx) => ({
      ...row,
      rowNumber: idx + 1,
    }))
  }

  /**
   * Generate full mathematical system (3^helg × 2^halvg combinations)
   */
  private generateFullSystem(helg: number, halvg: number): number[][] {
    const fullSystem: number[][] = []

    // Calculate total number of combinations
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
   * Map numeric pattern to actual match outcomes
   *
   * Pattern structure: [helg0, helg1, ..., helgN, halvg0, halvg1, ..., halvgM]
   * - First N positions are helgarderingar (ternary: 0='1', 1='X', 2='2')
   * - Next M positions are halvgarderingar (binary: 0=first outcome, 1=second outcome)
   *
   * IMPORTANT: Pattern positions are tied to ARRAY INDEX in the hedge assignment arrays,
   * not to match number encounter order. We iterate through the arrays directly.
   *
   * @param pattern - Numeric pattern from key rows
   * @param hedgeAssignment - Match assignments for spiks, helg, halvg (with halvOutcomes)
   * @param utgangstecken - Utgångstecken for U-systems
   * @param matchCount - Number of matches (13 for Stryktipset/Europatipset, 8 for Topptipset)
   * @param selections - Optional selections (fallback for halvgarderingar if no halvOutcomes)
   */
  private mapPatternToOutcomes(
    pattern: number[],
    hedgeAssignment: HedgeAssignment,
    utgangstecken?: Record<number, string>,
    matchCount: number = 13,
    selections?: CouponSelection[]
  ): string[] {
    const outcomes: string[] = new Array(matchCount)
    const helgCount = hedgeAssignment.helgarderingar.length

    // 1. Apply spik outcomes (fixed for all rows)
    for (const matchNum of hedgeAssignment.spiks) {
      outcomes[matchNum - 1] = hedgeAssignment.spikOutcomes[matchNum] || '1'
    }

    // 2. Apply helgardering values - array INDEX = pattern position
    hedgeAssignment.helgarderingar.forEach((matchNum, idx) => {
      const value = pattern[idx] ?? 0
      outcomes[matchNum - 1] = ['1', 'X', '2'][value] || '1'
    })

    // 3. Apply halvgardering values - offset by helgCount, use AI-determined halvOutcomes
    hedgeAssignment.halvgarderingar.forEach((matchNum, idx) => {
      const value = pattern[helgCount + idx] ?? 0 // 0 or 1

      // First priority: AI-determined halvOutcomes
      const aiHalvOutcomes = hedgeAssignment.halvOutcomes?.[matchNum]
      if (aiHalvOutcomes && aiHalvOutcomes.length === 2) {
        outcomes[matchNum - 1] = aiHalvOutcomes[value] || aiHalvOutcomes[0]
        return
      }

      // Second priority: selection string from coupon optimizer
      const selection = selections?.find(s => s.matchNumber === matchNum)
      if (selection?.selection && selection.selection.length >= 2) {
        const halvOutcomes = [selection.selection[0], selection.selection[1]]
        outcomes[matchNum - 1] = halvOutcomes[value] || halvOutcomes[0] || '1'
        return
      }

      // Third priority: utgångstecken for U-systems
      const utgangOutcome = utgangstecken?.[matchNum]
      if (utgangOutcome) {
        outcomes[matchNum - 1] =
          value === 0 ? utgangOutcome : this.getComplementaryOutcome(utgangOutcome)
        return
      }

      // Fallback: default mapping
      outcomes[matchNum - 1] = value === 0 ? '1' : 'X'
    })

    // Fill any remaining matches that weren't assigned (should not happen)
    for (let i = 0; i < matchCount; i++) {
      if (outcomes[i] === undefined) {
        outcomes[i] = '1'
      }
    }

    return outcomes
  }

  /**
   * Get complementary outcome for half hedge
   */
  private getComplementaryOutcome(outcome: string): string {
    // Simple rotation through outcomes
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
}

// Export singleton instance
export const systemGenerator = new SystemGenerator()
