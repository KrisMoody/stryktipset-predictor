/**
 * Dixon-Coles Bivariate Poisson Model for Football Match Prediction
 *
 * This implements the Dixon & Coles (1997) model which:
 * 1. Models goals as Poisson distributed
 * 2. Applies a correction factor (tau) for low-scoring matches (0-0, 1-0, 0-1, 1-1)
 * 3. The correction accounts for the correlation between home and away scores
 *
 * Reference:
 * Dixon, M. J., & Coles, S. G. (1997). "Modelling Association Football Scores
 * and Inefficiencies in the Football Betting Market"
 * Journal of the Royal Statistical Society: Series C, 46(2), 265-280.
 *
 * Core formulas:
 *   λ_home = homeAttack × awayDefense × homeAdvantage
 *   λ_away = awayAttack × homeDefense
 *   P(x, y) = τ(x, y, ρ) × poisson(x, λ_home) × poisson(y, λ_away)
 *
 * where τ is the Dixon-Coles correction for low scores
 */

import type { TeamRatings, DixonColesResult, ModelConfig } from './types'
import { DEFAULT_CONFIG } from './types'

/**
 * Calculate factorial (memoized for performance)
 */
const factorialCache: Record<number, number> = { 0: 1, 1: 1 }
function factorial(n: number): number {
  if (n < 0) return 1
  if (factorialCache[n]) return factorialCache[n]
  factorialCache[n] = n * factorial(n - 1)
  return factorialCache[n]
}

/**
 * Calculate Poisson probability
 * P(X = k) = (λ^k × e^-λ) / k!
 *
 * @param k - Number of goals
 * @param lambda - Expected goals (λ)
 * @returns Probability of exactly k goals
 */
export function poissonProbability(k: number, lambda: number): number {
  if (k < 0 || lambda <= 0) return 0
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k)
}

/**
 * Dixon-Coles correction factor (tau)
 *
 * Adjusts probabilities for low-scoring matches where the independence
 * assumption is violated. The correction is based on the rho parameter.
 *
 * @param homeGoals - Home team goals
 * @param awayGoals - Away team goals
 * @param lambdaHome - Expected home goals
 * @param lambdaAway - Expected away goals
 * @param rho - Correlation parameter (typically -0.1 to -0.05)
 * @returns Correction factor tau
 */
export function dixonColesCorrection(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number
): number {
  // Only apply correction to low-scoring matches
  if (homeGoals === 0 && awayGoals === 0) {
    // 0-0: tau = 1 - λ_home × λ_away × ρ
    return 1 - lambdaHome * lambdaAway * rho
  } else if (homeGoals === 0 && awayGoals === 1) {
    // 0-1: tau = 1 + λ_home × ρ
    return 1 + lambdaHome * rho
  } else if (homeGoals === 1 && awayGoals === 0) {
    // 1-0: tau = 1 + λ_away × ρ
    return 1 + lambdaAway * rho
  } else if (homeGoals === 1 && awayGoals === 1) {
    // 1-1: tau = 1 - ρ
    return 1 - rho
  }

  // No correction for other scorelines
  return 1.0
}

/**
 * Calculate expected goals (lambda values) for a match
 *
 * @param homeRatings - Home team ratings
 * @param awayRatings - Away team ratings
 * @param config - Model configuration
 * @returns Expected goals for each team
 */
export function calculateExpectedGoals(
  homeRatings: TeamRatings,
  awayRatings: TeamRatings,
  config: ModelConfig = DEFAULT_CONFIG
): { lambdaHome: number; lambdaAway: number } {
  // λ_home = homeAttack × awayDefense × homeAdvantage
  // Note: Higher defense = weaker defense (concedes more)
  // So we use inverse: awayDefense close to 1 = average, higher = concedes more
  const lambdaHome = homeRatings.attack * (1 / awayRatings.defense) * config.homeAdvantage

  // λ_away = awayAttack × homeDefense (no home advantage)
  const lambdaAway = awayRatings.attack * (1 / homeRatings.defense)

  return {
    lambdaHome: Math.max(0.1, lambdaHome), // Minimum 0.1 to avoid division issues
    lambdaAway: Math.max(0.1, lambdaAway),
  }
}

/**
 * Calculate probability of a specific scoreline
 *
 * @param homeGoals - Home team goals
 * @param awayGoals - Away team goals
 * @param lambdaHome - Expected home goals
 * @param lambdaAway - Expected away goals
 * @param rho - Correlation parameter
 * @returns Probability of this exact scoreline
 */
export function scorelineProbability(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number
): number {
  const tau = dixonColesCorrection(homeGoals, awayGoals, lambdaHome, lambdaAway, rho)
  const homeProb = poissonProbability(homeGoals, lambdaHome)
  const awayProb = poissonProbability(awayGoals, lambdaAway)

  return tau * homeProb * awayProb
}

/**
 * Calculate match outcome probabilities using Dixon-Coles model
 *
 * Sums over all possible scorelines up to maxGoals to get:
 * - P(home win) = sum of P(x, y) where x > y
 * - P(draw) = sum of P(x, y) where x = y
 * - P(away win) = sum of P(x, y) where x < y
 *
 * @param homeRatings - Home team ratings
 * @param awayRatings - Away team ratings
 * @param config - Model configuration
 * @returns Match outcome probabilities
 */
export function calculateOutcomeProbabilities(
  homeRatings: TeamRatings,
  awayRatings: TeamRatings,
  config: ModelConfig = DEFAULT_CONFIG
): DixonColesResult {
  const { lambdaHome, lambdaAway } = calculateExpectedGoals(homeRatings, awayRatings, config)

  let homeWinProb = 0
  let drawProb = 0
  let awayWinProb = 0

  // Sum over all scorelines from 0-0 to maxGoals-maxGoals
  for (let homeGoals = 0; homeGoals <= config.maxGoals; homeGoals++) {
    for (let awayGoals = 0; awayGoals <= config.maxGoals; awayGoals++) {
      const prob = scorelineProbability(homeGoals, awayGoals, lambdaHome, lambdaAway, config.rho)

      if (homeGoals > awayGoals) {
        homeWinProb += prob
      } else if (homeGoals === awayGoals) {
        drawProb += prob
      } else {
        awayWinProb += prob
      }
    }
  }

  // Normalize to ensure they sum to 1 (accounting for truncation at maxGoals)
  const total = homeWinProb + drawProb + awayWinProb
  if (total > 0) {
    homeWinProb /= total
    drawProb /= total
    awayWinProb /= total
  }

  return {
    homeWinProb,
    drawProb,
    awayWinProb,
    expectedHomeGoals: lambdaHome,
    expectedAwayGoals: lambdaAway,
  }
}

/**
 * Calculate outcome probabilities from expected goals directly
 * Useful when you already have lambda values from other sources (e.g., xG)
 *
 * @param lambdaHome - Expected home goals
 * @param lambdaAway - Expected away goals
 * @param config - Model configuration
 * @returns Match outcome probabilities
 */
export function calculateProbabilitiesFromLambda(
  lambdaHome: number,
  lambdaAway: number,
  config: ModelConfig = DEFAULT_CONFIG
): DixonColesResult {
  let homeWinProb = 0
  let drawProb = 0
  let awayWinProb = 0

  for (let homeGoals = 0; homeGoals <= config.maxGoals; homeGoals++) {
    for (let awayGoals = 0; awayGoals <= config.maxGoals; awayGoals++) {
      const prob = scorelineProbability(homeGoals, awayGoals, lambdaHome, lambdaAway, config.rho)

      if (homeGoals > awayGoals) {
        homeWinProb += prob
      } else if (homeGoals === awayGoals) {
        drawProb += prob
      } else {
        awayWinProb += prob
      }
    }
  }

  // Normalize
  const total = homeWinProb + drawProb + awayWinProb
  if (total > 0) {
    homeWinProb /= total
    drawProb /= total
    awayWinProb /= total
  }

  return {
    homeWinProb,
    drawProb,
    awayWinProb,
    expectedHomeGoals: lambdaHome,
    expectedAwayGoals: lambdaAway,
  }
}

/**
 * Calculate most likely scoreline
 *
 * @param lambdaHome - Expected home goals
 * @param lambdaAway - Expected away goals
 * @param config - Model configuration
 * @returns Most likely scoreline and its probability
 */
export function getMostLikelyScoreline(
  lambdaHome: number,
  lambdaAway: number,
  config: ModelConfig = DEFAULT_CONFIG
): { homeGoals: number; awayGoals: number; probability: number } {
  let maxProb = 0
  let bestHome = 0
  let bestAway = 0

  // Check common scorelines (0-0 to 5-5 is usually sufficient)
  const checkMax = Math.min(config.maxGoals, 6)

  for (let homeGoals = 0; homeGoals <= checkMax; homeGoals++) {
    for (let awayGoals = 0; awayGoals <= checkMax; awayGoals++) {
      const prob = scorelineProbability(homeGoals, awayGoals, lambdaHome, lambdaAway, config.rho)

      if (prob > maxProb) {
        maxProb = prob
        bestHome = homeGoals
        bestAway = awayGoals
      }
    }
  }

  return {
    homeGoals: bestHome,
    awayGoals: bestAway,
    probability: maxProb,
  }
}
