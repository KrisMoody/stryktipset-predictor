import { CouponOptimizer, type TopptipsetStake } from './coupon-optimizer'
import { systemGenerator } from './system-generator'
import { hedgeAssignmentService } from './hedge-assignment-service'
import { getGameConfig } from '~/server/constants/game-configs'
import type {
  SystemCoupon,
  BettingSystem,
  HedgeAssignment,
  CouponSelection,
  MGExtension,
} from '~/types'
import type { GameType } from '~/types/game-types'

/**
 * Enhanced coupon optimizer with R/U-system support
 */
export class CouponOptimizerV2 extends CouponOptimizer {
  /**
   * Generate system-based coupon using R or U-system
   */
  async generateSystemCoupon(
    drawNumber: number,
    systemId: string,
    utgangstecken?: Record<number, string>,
    mgExtensions?: MGExtension[],
    gameType: GameType = 'stryktipset',
    stake: TopptipsetStake = 1
  ): Promise<SystemCoupon | null> {
    try {
      const gameConfig = getGameConfig(gameType)
      console.log(
        `[CouponOptimizerV2] Generating ${gameType} system coupon for draw ${drawNumber} with system ${systemId}`
      )

      // Get system definition
      const system = systemGenerator.getSystem(systemId)
      if (!system) {
        throw new Error(`System ${systemId} not found`)
      }

      // Get AI-based optimal selections first
      const aiCoupon = await this.generateOptimalCoupon(drawNumber, 10000, gameType, stake) // High budget to get full analysis
      if (!aiCoupon) {
        throw new Error(`Failed to generate AI predictions for ${gameType} draw ${drawNumber}`)
      }

      const selections = aiCoupon.selections

      // Determine hedge assignment using AI-powered service (with algorithmic fallback)
      const hedgeAssignment = await hedgeAssignmentService.generateHedgeAssignment(
        selections,
        system,
        gameConfig.matchCount
      )

      // Update selections to reflect the hedge assignment (spik -> single, helg -> 1X2, halv -> 2 outcomes)
      const updatedSelections = this.updateSelectionsForSystem(selections, hedgeAssignment)

      // For U-systems: auto-generate utgångstecken if not provided
      let finalUtgangstecken = utgangstecken
      if (system.type === 'U' && !utgangstecken) {
        finalUtgangstecken = this.autoGenerateUtgangstecken(updatedSelections, hedgeAssignment)
      }

      // Generate coupon rows using the system
      const rows = systemGenerator.applySystem(
        system,
        hedgeAssignment,
        finalUtgangstecken,
        mgExtensions,
        gameConfig.matchCount,
        updatedSelections
      )

      // Calculate total cost (stake per row for Topptipset, 1 SEK per row for others)
      const costPerRow = gameType === 'topptipset' ? stake : 1
      const totalCost = rows.length * costPerRow

      // Calculate expected value (average of all selections)
      const expectedValue = this.calculateOverallEV(updatedSelections)

      return {
        drawNumber,
        system,
        selections: updatedSelections,
        utgangstecken: finalUtgangstecken,
        rows,
        totalCost,
        expectedValue,
      }
    } catch (error) {
      console.error(`[CouponOptimizerV2] Error generating system coupon:`, error)
      return null
    }
  }

  /**
   * Determine which matches should be hedged based on AI predictions and system requirements
   *
   * Strategy:
   * 1. Sort matches by confidence/EV
   * 2. High-confidence matches → spiks
   * 3. Low-confidence matches → helgarderingar (need full 1X2 coverage)
   * 4. Medium-confidence matches → halvgarderingar (need 2-way coverage)
   * 5. Ensure total spiks + helg + halvg = matchCount and helg + halvg = system requirements
   */
  private determineHedgeAssignment(
    selections: CouponSelection[],
    system: BettingSystem,
    matchCount: number = 13
  ): HedgeAssignment {
    const totalHedges = system.helgarderingar + system.halvgarderingar
    const totalSpiks = matchCount - totalHedges

    // Sort matches by confidence (spik-suitable first, then by EV)
    const sorted = [...selections].sort((a, b) => {
      if (a.is_spik && !b.is_spik) return -1
      if (!a.is_spik && b.is_spik) return 1
      return b.expected_value - a.expected_value
    })

    const spiks: number[] = []
    const helgarderingar: number[] = []
    const halvgarderingar: number[] = []
    const spikOutcomes: Record<number, string> = {}

    // Assign spiks (top N high-confidence matches)
    for (let i = 0; i < totalSpiks && i < sorted.length; i++) {
      const sel = sorted[i]!
      spiks.push(sel.matchNumber)
      spikOutcomes[sel.matchNumber] = sel.selection.length === 1 ? sel.selection : sel.selection[0]! // Take first character if multiple outcomes
    }

    // Assign helgarderingar and halvgarderingar to remaining matches
    const remaining = sorted.slice(totalSpiks)

    // Sort remaining by uncertainty (lowest EV = most uncertain = needs full hedge)
    const sortedByUncertainty = remaining.sort((a, b) => a.expected_value - b.expected_value)

    // Assign helgarderingar (most uncertain matches) - EXACTLY system.helgarderingar count
    for (let i = 0; i < system.helgarderingar && i < sortedByUncertainty.length; i++) {
      helgarderingar.push(sortedByUncertainty[i]!.matchNumber)
    }

    // Assign halvgarderingar - EXACTLY system.halvgarderingar count (not all remaining!)
    const halvgEnd = system.helgarderingar + system.halvgarderingar
    for (let i = system.helgarderingar; i < halvgEnd && i < sortedByUncertainty.length; i++) {
      halvgarderingar.push(sortedByUncertainty[i]!.matchNumber)
    }

    // Validate hedge counts match system requirements
    const expectedSpiks = matchCount - system.helgarderingar - system.halvgarderingar
    if (
      helgarderingar.length !== system.helgarderingar ||
      halvgarderingar.length !== system.halvgarderingar ||
      spiks.length !== expectedSpiks
    ) {
      console.error(
        `[CouponOptimizerV2] Hedge count mismatch! System ${system.id} requires: ${system.helgarderingar} helg, ${system.halvgarderingar} halvg, ${expectedSpiks} spiks. Got: ${helgarderingar.length} helg, ${halvgarderingar.length} halvg, ${spiks.length} spiks`
      )
    }

    console.log(
      `[CouponOptimizerV2] Hedge assignment for ${system.id}: ${spiks.length} spiks, ${helgarderingar.length} helg, ${halvgarderingar.length} halvg`
    )

    return {
      spiks,
      helgarderingar,
      halvgarderingar,
      spikOutcomes,
    }
  }

  /**
   * Update selections to reflect the system's hedge assignment
   *
   * This ensures the selections array accurately represents what the system will play:
   * - Spiks get single outcomes
   * - Helgarderingar get full coverage (1X2)
   * - Halvgarderingar get two-way coverage (best two outcomes)
   */
  private updateSelectionsForSystem(
    selections: CouponSelection[],
    hedgeAssignment: HedgeAssignment
  ): CouponSelection[] {
    return selections.map(sel => {
      const matchNum = sel.matchNumber

      if (hedgeAssignment.spiks.includes(matchNum)) {
        // Spik: single outcome (use the assigned spik outcome or first char of current selection)
        const spikOutcome = hedgeAssignment.spikOutcomes[matchNum] || sel.selection[0] || '1'
        return {
          ...sel,
          selection: spikOutcome,
          is_spik: true,
          reasoning: `System spik: ${spikOutcome} (${sel.reasoning})`,
        }
      } else if (hedgeAssignment.helgarderingar.includes(matchNum)) {
        // Helgardering: full coverage (1X2)
        return {
          ...sel,
          selection: '1X2',
          is_spik: false,
          reasoning: `System helgardering (${sel.reasoning})`,
        }
      } else if (hedgeAssignment.halvgarderingar.includes(matchNum)) {
        // Halvgardering: two-way coverage
        // If already has 2 outcomes, keep them; otherwise pick best two based on original selection
        let halvSelection = sel.selection
        if (sel.selection.length === 1) {
          // Need to expand to 2 outcomes - add the next most likely
          if (sel.selection === '1') halvSelection = '1X'
          else if (sel.selection === '2') halvSelection = 'X2'
          else halvSelection = '1X' // X -> 1X
        } else if (sel.selection.length === 3) {
          // Need to reduce from 3 to 2 - keep best two
          halvSelection = sel.selection.substring(0, 2)
        }
        return {
          ...sel,
          selection: halvSelection,
          is_spik: false,
          reasoning: `System halvgardering: ${halvSelection} (${sel.reasoning})`,
        }
      }

      // Should not reach here, but return original if somehow not assigned
      return sel
    })
  }

  /**
   * Auto-generate utgångstecken from AI predictions for U-systems
   *
   * Strategy: Use the highest probability outcome for each hedged match
   */
  private autoGenerateUtgangstecken(
    selections: CouponSelection[],
    hedgeAssignment: HedgeAssignment
  ): Record<number, string> {
    const utgangstecken: Record<number, string> = {}

    // Get hedged match numbers
    const hedgedMatches = [...hedgeAssignment.helgarderingar, ...hedgeAssignment.halvgarderingar]

    for (const matchNum of hedgedMatches) {
      const selection = selections.find(s => s.matchNumber === matchNum)
      if (selection) {
        // Use the first character of the selection (highest probability outcome)
        utgangstecken[matchNum] =
          selection.selection.length === 1 ? selection.selection : selection.selection[0]!
      }
    }

    console.log(
      `[CouponOptimizerV2] Auto-generated utgångstecken for ${Object.keys(utgangstecken).length} matches`
    )

    return utgangstecken
  }

  /**
   * Calculate overall expected value (override parent method)
   */
  protected override calculateOverallEV(selections: CouponSelection[]): number {
    const avgEV = selections.reduce((sum, sel) => sum + sel.expected_value, 0) / selections.length
    return avgEV
  }
}

// Export singleton instance
export const couponOptimizerV2 = new CouponOptimizerV2()
