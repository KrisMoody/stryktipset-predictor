import { CouponOptimizer } from './coupon-optimizer'
import { systemGenerator } from './system-generator'
import type {
  SystemCoupon,
  BettingSystem,
  HedgeAssignment,
  CouponSelection,
  MGExtension,
} from '~/types'

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
    mgExtensions?: MGExtension[]
  ): Promise<SystemCoupon | null> {
    try {
      console.log(
        `[CouponOptimizerV2] Generating system coupon for draw ${drawNumber} with system ${systemId}`
      )

      // Get system definition
      const system = systemGenerator.getSystem(systemId)
      if (!system) {
        throw new Error(`System ${systemId} not found`)
      }

      // Get AI-based optimal selections first
      const aiCoupon = await this.generateOptimalCoupon(drawNumber, 10000) // High budget to get full analysis
      if (!aiCoupon) {
        throw new Error(`Failed to generate AI predictions for draw ${drawNumber}`)
      }

      const selections = aiCoupon.selections

      // Determine hedge assignment based on system requirements and AI predictions
      const hedgeAssignment = this.determineHedgeAssignment(selections, system)

      // For U-systems: auto-generate utgångstecken if not provided
      let finalUtgangstecken = utgangstecken
      if (system.type === 'U' && !utgangstecken) {
        finalUtgangstecken = this.autoGenerateUtgangstecken(selections, hedgeAssignment)
      }

      // Generate coupon rows using the system
      const rows = systemGenerator.applySystem(
        system,
        hedgeAssignment,
        finalUtgangstecken,
        mgExtensions
      )

      // Calculate total cost (1 SEK per row)
      const totalCost = rows.length

      // Calculate expected value (average of all selections)
      const expectedValue = this.calculateOverallEV(selections)

      return {
        drawNumber,
        system,
        selections,
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
   * 5. Ensure total spiks + helg + halvg = 13 and helg + halvg = system requirements
   */
  private determineHedgeAssignment(
    selections: CouponSelection[],
    system: BettingSystem
  ): HedgeAssignment {
    const totalHedges = system.helgarderingar + system.halvgarderingar
    const totalSpiks = 13 - totalHedges

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

    // Assign helgarderingar (most uncertain matches)
    for (let i = 0; i < system.helgarderingar && i < sortedByUncertainty.length; i++) {
      helgarderingar.push(sortedByUncertainty[i]!.matchNumber)
    }

    // Assign halvgarderingar (remaining matches)
    for (let i = system.helgarderingar; i < sortedByUncertainty.length; i++) {
      halvgarderingar.push(sortedByUncertainty[i]!.matchNumber)
    }

    console.log(
      `[CouponOptimizerV2] Hedge assignment: ${spiks.length} spiks, ${helgarderingar.length} helg, ${halvgarderingar.length} halvg`
    )

    return {
      spiks,
      helgarderingar,
      halvgarderingar,
      spikOutcomes,
    }
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
