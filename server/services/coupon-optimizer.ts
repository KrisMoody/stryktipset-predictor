import { prisma } from '~/server/utils/prisma'
import type { predictions, match_odds } from '@prisma/client'
import type { OptimalCoupon, CouponSelection, ExpectedValue, GameType } from '~/types'
import { getGameConfig } from '~/server/constants/game-configs'

/**
 * Valid stake options for Topptipset
 */
export const TOPPTIPSET_STAKES = [1, 2, 5, 10] as const
export type TopptipsetStake = (typeof TOPPTIPSET_STAKES)[number]

/**
 * Service for generating optimal betting coupons
 */
export class CouponOptimizer {
  /**
   * Generate optimal coupon for a draw
   *
   * @param drawNumber - The draw number to generate coupon for
   * @param budget - Maximum budget in SEK (default: 500)
   * @param gameType - Game type (default: 'stryktipset')
   * @param stake - Stake per row for Topptipset (1, 2, 5, or 10 SEK)
   */
  async generateOptimalCoupon(
    drawNumber: number,
    budget: number = 500,
    gameType: GameType = 'stryktipset',
    stake: TopptipsetStake = 1
  ): Promise<OptimalCoupon | null> {
    try {
      const gameConfig = getGameConfig(gameType)

      console.log(
        `[Coupon Optimizer] Generating optimal ${gameType} coupon for draw ${drawNumber} with budget ${budget} SEK` +
          (gameType === 'topptipset' ? ` (stake: ${stake} SEK/row)` : '')
      )

      // Get draw and its matches with predictions
      const draw = await prisma.draws.findUnique({
        where: { game_type_draw_number: { game_type: gameType, draw_number: drawNumber } },
        include: {
          matches: {
            orderBy: { match_number: 'asc' },
            include: {
              homeTeam: true,
              awayTeam: true,
              predictions: {
                orderBy: { created_at: 'desc' },
                take: 1,
              },
              match_odds: {
                where: { type: 'current' },
                orderBy: { collected_at: 'desc' },
                take: 1,
              },
            },
          },
        },
      })

      if (!draw) {
        throw new Error(`${gameType} draw ${drawNumber} not found`)
      }

      if (draw.matches.length !== gameConfig.matchCount) {
        throw new Error(
          `${gameType} draw ${drawNumber} does not have ${gameConfig.matchCount} matches`
        )
      }

      // Check if all matches have predictions
      const matchesWithoutPredictions = draw.matches.filter(
        m => !m.predictions || m.predictions.length === 0
      )
      if (matchesWithoutPredictions.length > 0) {
        throw new Error(
          `Missing predictions for matches: ${matchesWithoutPredictions.map(m => m.match_number).join(', ')}`
        )
      }

      // Generate selections for each match
      const selections: CouponSelection[] = []
      let spikCount = 0

      for (const match of draw.matches) {
        const prediction = match.predictions[0]
        if (!prediction) continue

        const odds = match.match_odds[0]

        // Calculate expected values
        const expectedValues = this.calculateExpectedValues(prediction, odds)

        // Determine if suitable as spik
        const isSpik = prediction.is_spik_suitable && prediction.confidence === 'high'

        // Determine optimal selection
        let selection = this.determineOptimalSelection(expectedValues, isSpik, budget, spikCount)

        // If spik, use single outcome
        if (isSpik) {
          selection = this.getBestSingleOutcome(expectedValues)
          spikCount++
        }

        selections.push({
          matchNumber: match.match_number,
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          selection,
          is_spik: isSpik,
          expected_value: this.getSelectionEV(selection, expectedValues),
          reasoning: this.getSelectionReasoning(selection, expectedValues, isSpik),
        })
      }

      // Calculate total combinations and cost
      const totalCombinations = this.calculateTotalCombinations(selections)
      // Cost per row: 1 SEK for Stryktipset/Europatipset, variable stake for Topptipset
      const costPerRow = gameType === 'topptipset' ? stake : 1
      const _totalCost = totalCombinations * costPerRow

      // If over budget, reduce garderings
      // For Topptipset with stake, adjust the effective budget for combination count
      const maxCombinations = Math.floor(budget / costPerRow)
      if (totalCombinations > maxCombinations) {
        await this.reduceCombinations(selections, maxCombinations)
      }

      const finalCombinations = this.calculateTotalCombinations(selections)
      const finalCost = finalCombinations * costPerRow

      // Calculate overall expected value
      const expectedValue = this.calculateOverallEV(selections)

      return {
        drawNumber,
        selections,
        totalCombinations: finalCombinations,
        totalCost: finalCost,
        expectedValue,
        budget,
      }
    } catch (error) {
      console.error(`[Coupon Optimizer] Error generating optimal coupon:`, error)
      return null
    }
  }

  /**
   * Calculate expected values for all outcomes
   */
  private calculateExpectedValues(
    prediction: predictions,
    odds: match_odds | null | undefined
  ): ExpectedValue[] {
    const results: ExpectedValue[] = []

    if (!odds) {
      // No odds data, use probabilities only
      return [
        {
          outcome: '1',
          probability: Number(prediction.probability_home),
          crowd_probability: 33.33,
          odds: 1,
          ev: Number(prediction.probability_home),
          is_value_bet: false,
        },
        {
          outcome: 'X',
          probability: Number(prediction.probability_draw),
          crowd_probability: 33.33,
          odds: 1,
          ev: Number(prediction.probability_draw),
          is_value_bet: false,
        },
        {
          outcome: '2',
          probability: Number(prediction.probability_away),
          crowd_probability: 33.33,
          odds: 1,
          ev: Number(prediction.probability_away),
          is_value_bet: false,
        },
      ]
    }

    const svenskaFolket = {
      home: parseFloat(odds.svenska_folket_home || '33.33'),
      draw: parseFloat(odds.svenska_folket_draw || '33.33'),
      away: parseFloat(odds.svenska_folket_away || '33.33'),
    }

    // Calculate EV for each outcome
    const outcomes: Array<{
      outcome: '1' | 'X' | '2'
      prob: number
      crowdProb: number
      odds: number
    }> = [
      {
        outcome: '1',
        prob: Number(prediction.probability_home),
        crowdProb: svenskaFolket.home,
        odds: Number(odds.home_odds),
      },
      {
        outcome: 'X',
        prob: Number(prediction.probability_draw),
        crowdProb: svenskaFolket.draw,
        odds: Number(odds.draw_odds),
      },
      {
        outcome: '2',
        prob: Number(prediction.probability_away),
        crowdProb: svenskaFolket.away,
        odds: Number(odds.away_odds),
      },
    ]

    for (const { outcome, prob, crowdProb, odds: outcomeOdds } of outcomes) {
      const ev = prob * 100 * outcomeOdds - 100
      const is_value_bet = prob * 100 > crowdProb

      results.push({
        outcome,
        probability: prob,
        crowd_probability: crowdProb,
        odds: outcomeOdds,
        ev,
        is_value_bet,
      })
    }

    return results
  }

  /**
   * Determine optimal selection for a match
   */
  private determineOptimalSelection(
    evs: ExpectedValue[],
    isSpik: boolean,
    budget: number,
    currentSpiks: number
  ): string {
    if (isSpik || currentSpiks >= 10) {
      // Use single outcome
      return this.getBestSingleOutcome(evs)
    }

    // Sort by EV
    const sorted = [...evs].sort((a, b) => b.ev - a.ev)

    if (sorted.length < 2) {
      return sorted[0]?.outcome || '1'
    }

    // If top outcome has much higher EV, use single
    if (sorted[0]!.ev > sorted[1]!.ev + 10) {
      return sorted[0]!.outcome
    }

    // If top two are close, use double
    if (sorted[0]!.ev > sorted[1]!.ev - 5) {
      const outcomes = [sorted[0]!.outcome, sorted[1]!.outcome].sort()
      return outcomes.join('')
    }

    // Otherwise use triple (but only if budget allows)
    if (budget >= 4000) {
      return '1X2'
    }

    // Default to best single
    return sorted[0]!.outcome
  }

  /**
   * Get best single outcome by EV
   */
  private getBestSingleOutcome(evs: ExpectedValue[]): string {
    if (evs.length === 0) return '1'
    return evs.reduce((best, current) => (current.ev > best.ev ? current : best), evs[0]!).outcome
  }

  /**
   * Get expected value for a selection
   */
  private getSelectionEV(selection: string, evs: ExpectedValue[]): number {
    if (selection.length === 1) {
      return evs.find(ev => ev.outcome === selection)?.ev || 0
    }

    // For multiple outcomes, average the EVs
    const outcomes = selection.split('')
    const avgEV =
      outcomes.reduce((sum, outcome) => {
        const ev = evs.find(e => e.outcome === outcome)?.ev || 0
        return sum + ev
      }, 0) / outcomes.length

    return avgEV
  }

  /**
   * Get reasoning for selection
   */
  private getSelectionReasoning(selection: string, evs: ExpectedValue[], isSpik: boolean): string {
    if (isSpik) {
      return `High confidence spik: ${selection}`
    }

    const ev = this.getSelectionEV(selection, evs)
    if (ev > 10) {
      return `Strong value bet (EV: ${ev.toFixed(1)}%)`
    } else if (ev > 0) {
      return `Positive EV (${ev.toFixed(1)}%)`
    } else {
      return `Best available option`
    }
  }

  /**
   * Calculate total combinations
   */
  private calculateTotalCombinations(selections: CouponSelection[]): number {
    return selections.reduce((total, sel) => total * sel.selection.length, 1)
  }

  /**
   * Calculate overall expected value
   */
  protected calculateOverallEV(selections: CouponSelection[]): number {
    const avgEV = selections.reduce((sum, sel) => sum + sel.expected_value, 0) / selections.length
    return avgEV
  }

  /**
   * Reduce combinations to fit budget
   */
  private async reduceCombinations(selections: CouponSelection[], budget: number): Promise<void> {
    // Find non-spik matches with most selections
    const nonSpiks = selections.filter(s => !s.is_spik)
    nonSpiks.sort((a, b) => b.selection.length - a.selection.length)

    // Reduce combinations by converting some garderings to single selections
    for (const sel of nonSpiks) {
      if (this.calculateTotalCombinations(selections) <= budget) {
        break
      }

      if (sel.selection.length > 1) {
        // Convert to best single outcome
        const firstChar = sel.selection[0]
        if (firstChar) {
          sel.selection = firstChar
          sel.reasoning = `Reduced to single for budget: ${sel.selection}`
        }
      }
    }
  }
}

// Export singleton instance
export const couponOptimizer = new CouponOptimizer()
