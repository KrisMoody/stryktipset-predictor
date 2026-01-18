/**
 * Form Calculator - EMA-based Form and Regression Detection
 *
 * Calculates team form using Exponential Moving Average (EMA) which:
 * - Weights recent matches more heavily
 * - Provides a continuous 0-1 score
 * - Can detect over/underperforming teams (regression candidates)
 *
 * Formula:
 *   EMA_new = α × latest + (1 - α) × EMA_previous
 *
 * where α = 0.3 means 30% weight on latest result
 */

import type { RecentMatch, FormMetrics, RegressionFlag, ModelConfig } from './types'
import { DEFAULT_CONFIG } from './types'

// Re-export RecentMatch type for external use
export type { RecentMatch } from './types'

/**
 * Convert match result to points value
 * Win = 1.0, Draw = 0.33, Loss = 0.0 (normalized to 0-1 range)
 */
export function resultToPoints(outcome: 'W' | 'D' | 'L'): number {
  switch (outcome) {
    case 'W':
      return 1.0
    case 'D':
      return 0.33 // Draw is worth ~1/3 of a win
    case 'L':
      return 0.0
  }
}

/**
 * Calculate xG-based result
 * Returns expected outcome based on xG difference
 *
 * @param xgFor - Team's xG
 * @param xgAgainst - Opponent's xG
 * @returns Points value based on xG (0-1 range)
 */
export function xgToPoints(xgFor: number, xgAgainst: number): number {
  const diff = xgFor - xgAgainst

  // Convert xG difference to points using sigmoid-like function
  // Large positive diff → 1.0, large negative → 0.0
  if (diff > 1.0) return 1.0
  if (diff < -1.0) return 0.0

  // Linear interpolation for small differences
  // diff = 0 → 0.5 (even match)
  // diff = 1 → 1.0 (dominant xG)
  // diff = -1 → 0.0 (dominated xG)
  return 0.5 + diff * 0.5
}

/**
 * Calculate Exponential Moving Average form score
 *
 * @param matches - Recent matches (most recent first)
 * @param alpha - Smoothing factor (0.3 = 30% weight on latest)
 * @returns EMA form score (0-1)
 */
export function calculateEMAForm(
  matches: RecentMatch[],
  alpha: number = DEFAULT_CONFIG.emaAlpha
): number {
  if (matches.length === 0) return 0.5 // Default to neutral form

  // Start with the oldest match
  const sortedMatches = [...matches].sort((a, b) => a.matchDate.getTime() - b.matchDate.getTime())

  let ema = 0.5 // Start at neutral

  for (const match of sortedMatches) {
    const points = resultToPoints(match.outcome)
    ema = alpha * points + (1 - alpha) * ema
  }

  return Math.max(0, Math.min(1, ema)) // Clamp to 0-1
}

/**
 * Calculate xG-based EMA form (performance-based rather than result-based)
 *
 * @param matches - Recent matches with xG data
 * @param alpha - Smoothing factor
 * @returns xG-based form score (0-1) or null if no xG data
 */
export function calculateXGForm(
  matches: RecentMatch[],
  alpha: number = DEFAULT_CONFIG.emaAlpha
): number | null {
  // Filter to matches with xG data
  const xgMatches = matches.filter(m => m.xgFor !== null && m.xgAgainst !== null)

  if (xgMatches.length < 3) return null // Need at least 3 matches

  const sortedMatches = [...xgMatches].sort((a, b) => a.matchDate.getTime() - b.matchDate.getTime())

  let ema = 0.5

  for (const match of sortedMatches) {
    const points = xgToPoints(match.xgFor!, match.xgAgainst!)
    ema = alpha * points + (1 - alpha) * ema
  }

  return Math.max(0, Math.min(1, ema))
}

/**
 * Calculate xG trend (improving or declining)
 *
 * Computes the average xG differential over recent matches
 * Positive = improving/scoring more than conceding
 * Negative = declining/conceding more than scoring
 *
 * @param matches - Recent matches with xG data (most recent first)
 * @returns xG differential trend or null if insufficient data
 */
export function calculateXGTrend(matches: RecentMatch[]): number | null {
  const xgMatches = matches.filter(m => m.xgFor !== null && m.xgAgainst !== null)

  if (xgMatches.length < 3) return null

  // Take last 5 matches with xG
  const recentXG = xgMatches.slice(0, 5)

  const avgDiff = recentXG.reduce((sum, m) => sum + (m.xgFor! - m.xgAgainst!), 0) / recentXG.length

  return avgDiff
}

/**
 * Identify regression candidates
 *
 * Compares actual form (results-based) to expected form (xG-based)
 * Large discrepancies suggest the team is over/underperforming
 *
 * @param actualForm - Results-based EMA form
 * @param xgForm - xG-based EMA form
 * @param threshold - Minimum difference to flag (default 0.2)
 * @returns Regression flag or null if no significant difference
 */
export function identifyRegressionCandidate(
  actualForm: number,
  xgForm: number | null,
  threshold: number = 0.2
): RegressionFlag {
  if (xgForm === null) return null

  const diff = actualForm - xgForm

  if (diff > threshold) {
    // Actual form > xG form: winning more than expected
    return 'overperforming'
  } else if (diff < -threshold) {
    // Actual form < xG form: losing more than expected
    return 'underperforming'
  }

  return null
}

/**
 * Calculate complete form metrics for a team
 *
 * @param matches - Recent matches (most recent first)
 * @param config - Model configuration
 * @returns Form metrics including EMA, xG trend, and regression flag
 */
export function calculateFormMetrics(
  matches: RecentMatch[],
  config: ModelConfig = DEFAULT_CONFIG
): FormMetrics {
  // Limit to lookback period
  const recentMatches = matches.slice(0, config.formLookback)

  // Calculate EMA form
  const emaForm = calculateEMAForm(recentMatches, config.emaAlpha)

  // Calculate xG-based metrics
  const xgForm = calculateXGForm(recentMatches, config.emaAlpha)
  const xgTrend = calculateXGTrend(recentMatches)

  // Check for regression
  const regressionFlag = identifyRegressionCandidate(emaForm, xgForm)

  return {
    emaForm,
    xgTrend,
    regressionFlag,
  }
}

/**
 * Determine match outcome from goals
 */
export function determineOutcome(goalsFor: number, goalsAgainst: number): 'W' | 'D' | 'L' {
  if (goalsFor > goalsAgainst) return 'W'
  if (goalsFor === goalsAgainst) return 'D'
  return 'L'
}
