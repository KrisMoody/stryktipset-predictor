/**
 * Value Calculator - Fair Odds and Expected Value
 *
 * Calculates:
 * 1. Fair probabilities by removing bookmaker margin (overround)
 * 2. Expected Value (EV) for each outcome
 * 3. Identifies value betting opportunities
 *
 * Formulas:
 *   Implied Probability = 1 / odds
 *   Margin = sum(implied_probabilities) - 1
 *   Fair Probability = implied_probability / sum(implied_probabilities)
 *   EV = (model_probability × odds) - 1
 */

import type { MatchOdds, FairProbabilities, ExpectedValues, Outcome, ModelConfig } from './types'
import { DEFAULT_CONFIG } from './types'

/**
 * Convert decimal odds to implied probability
 *
 * @param odds - Decimal odds (e.g., 2.50)
 * @returns Implied probability (e.g., 0.40 for 40%)
 */
export function oddsToImpliedProbability(odds: number): number {
  if (odds <= 1) return 1 // Handle invalid odds
  return 1 / odds
}

/**
 * Calculate bookmaker margin (overround)
 *
 * @param odds - Match odds for all three outcomes
 * @returns Margin as decimal (e.g., 0.05 for 5% margin)
 */
export function calculateMargin(odds: MatchOdds): number {
  const impliedHome = oddsToImpliedProbability(odds.homeOdds)
  const impliedDraw = oddsToImpliedProbability(odds.drawOdds)
  const impliedAway = oddsToImpliedProbability(odds.awayOdds)

  return impliedHome + impliedDraw + impliedAway - 1
}

/**
 * Calculate fair probabilities by removing bookmaker margin
 *
 * @param odds - Match odds for all three outcomes
 * @returns Fair probabilities and margin
 */
export function calculateFairProbabilities(odds: MatchOdds): FairProbabilities {
  const impliedHome = oddsToImpliedProbability(odds.homeOdds)
  const impliedDraw = oddsToImpliedProbability(odds.drawOdds)
  const impliedAway = oddsToImpliedProbability(odds.awayOdds)

  const total = impliedHome + impliedDraw + impliedAway
  const margin = total - 1

  return {
    homeProbability: impliedHome / total,
    drawProbability: impliedDraw / total,
    awayProbability: impliedAway / total,
    margin,
  }
}

/**
 * Calculate Expected Value for a single bet
 *
 * EV = (probability × odds) - 1
 *
 * Positive EV means the bet has positive expected return
 * Negative EV means expected loss
 *
 * @param probability - Model's probability for the outcome
 * @param odds - Decimal odds offered
 * @returns Expected value (e.g., 0.10 means 10% expected return)
 */
export function calculateEV(probability: number, odds: number): number {
  return probability * odds - 1
}

/**
 * Calculate Expected Values for all outcomes
 *
 * @param modelProbabilities - Model's probabilities for each outcome
 * @param odds - Match odds
 * @param config - Model configuration (for EV threshold)
 * @returns Expected values and best value outcome
 */
export function calculateExpectedValues(
  modelProbabilities: {
    homeProb: number
    drawProb: number
    awayProb: number
  },
  odds: MatchOdds,
  config: ModelConfig = DEFAULT_CONFIG
): ExpectedValues {
  const evHome = calculateEV(modelProbabilities.homeProb, odds.homeOdds)
  const evDraw = calculateEV(modelProbabilities.drawProb, odds.drawOdds)
  const evAway = calculateEV(modelProbabilities.awayProb, odds.awayOdds)

  // Find best value outcome (highest positive EV above threshold)
  let bestValueOutcome: Outcome | null = null
  let bestEV = config.evThreshold // Minimum threshold

  if (evHome > bestEV) {
    bestEV = evHome
    bestValueOutcome = '1'
  }
  if (evDraw > bestEV) {
    bestEV = evDraw
    bestValueOutcome = 'X'
  }
  if (evAway > bestEV) {
    bestEV = evAway
    bestValueOutcome = '2'
  }

  return {
    evHome,
    evDraw,
    evAway,
    bestValueOutcome,
  }
}

/**
 * Convert probability to fair odds
 *
 * @param probability - Probability (0-1)
 * @returns Decimal odds
 */
export function probabilityToOdds(probability: number): number {
  if (probability <= 0) return 999.99 // Very unlikely
  if (probability >= 1) return 1.01 // Certain
  return 1 / probability
}

/**
 * Calculate Kelly Criterion bet size
 *
 * Kelly fraction = (bp - q) / b
 * where:
 *   b = odds - 1 (net odds)
 *   p = probability of winning
 *   q = probability of losing (1 - p)
 *
 * @param probability - Model's probability for the outcome
 * @param odds - Decimal odds
 * @param fraction - Kelly fraction (0.25 = quarter Kelly, safer)
 * @returns Recommended stake as fraction of bankroll (0-1)
 */
export function calculateKellyFraction(
  probability: number,
  odds: number,
  fraction: number = 0.25
): number {
  const b = odds - 1
  const p = probability
  const q = 1 - probability

  const fullKelly = (b * p - q) / b

  // Don't bet if Kelly is negative
  if (fullKelly <= 0) return 0

  // Apply fractional Kelly for safety
  return Math.min(fullKelly * fraction, 0.1) // Cap at 10% of bankroll
}

/**
 * Analyze value across all outcomes
 *
 * @param modelProbabilities - Model's probabilities
 * @param odds - Match odds
 * @param config - Model configuration
 * @returns Detailed value analysis
 */
export function analyzeValue(
  modelProbabilities: {
    homeProb: number
    drawProb: number
    awayProb: number
  },
  odds: MatchOdds,
  config: ModelConfig = DEFAULT_CONFIG
): {
  expectedValues: ExpectedValues
  fairProbabilities: FairProbabilities
  valueOpportunities: Array<{
    outcome: Outcome
    ev: number
    edge: number // Model prob - fair prob
    kellyFraction: number
  }>
} {
  const expectedValues = calculateExpectedValues(modelProbabilities, odds, config)
  const fairProbabilities = calculateFairProbabilities(odds)

  // Find all value opportunities
  const opportunities: Array<{
    outcome: Outcome
    ev: number
    edge: number
    kellyFraction: number
  }> = []

  // Home
  const homeEdge = modelProbabilities.homeProb - fairProbabilities.homeProbability
  if (expectedValues.evHome > config.evThreshold) {
    opportunities.push({
      outcome: '1',
      ev: expectedValues.evHome,
      edge: homeEdge,
      kellyFraction: calculateKellyFraction(modelProbabilities.homeProb, odds.homeOdds),
    })
  }

  // Draw
  const drawEdge = modelProbabilities.drawProb - fairProbabilities.drawProbability
  if (expectedValues.evDraw > config.evThreshold) {
    opportunities.push({
      outcome: 'X',
      ev: expectedValues.evDraw,
      edge: drawEdge,
      kellyFraction: calculateKellyFraction(modelProbabilities.drawProb, odds.drawOdds),
    })
  }

  // Away
  const awayEdge = modelProbabilities.awayProb - fairProbabilities.awayProbability
  if (expectedValues.evAway > config.evThreshold) {
    opportunities.push({
      outcome: '2',
      ev: expectedValues.evAway,
      edge: awayEdge,
      kellyFraction: calculateKellyFraction(modelProbabilities.awayProb, odds.awayOdds),
    })
  }

  // Sort by EV descending
  opportunities.sort((a, b) => b.ev - a.ev)

  return {
    expectedValues,
    fairProbabilities,
    valueOpportunities: opportunities,
  }
}
