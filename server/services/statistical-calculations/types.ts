/**
 * Type definitions for statistical calculations
 *
 * References:
 * - Dixon-Coles model: Dixon & Coles (1997) "Modelling Association Football Scores and Inefficiencies in the Football Betting Market"
 * - Elo rating: Arpad Elo's rating system adapted for football
 */

export type RatingType = 'elo' | 'attack' | 'defense'
export type Confidence = 'low' | 'medium' | 'high'
export type DataQuality = 'full' | 'partial' | 'minimal'
export type RegressionFlag = 'overperforming' | 'underperforming' | null
export type Outcome = '1' | 'X' | '2'

/**
 * Team ratings (Elo + attack/defense strength)
 */
export interface TeamRatings {
  teamId: number
  elo: number // Standard Elo rating (~1500 baseline)
  attack: number // Attack strength multiplier (~1.0 baseline)
  defense: number // Defense strength multiplier (~1.0 baseline)
  matchesPlayed: number
  confidence: Confidence
  lastMatchDate: Date | null
}

/**
 * Default rating values for new teams
 */
export const DEFAULT_RATINGS: Omit<TeamRatings, 'teamId' | 'lastMatchDate'> = {
  elo: 1500,
  attack: 1.0,
  defense: 1.0,
  matchesPlayed: 0,
  confidence: 'low',
}

/**
 * Odds from bookmaker (decimal format)
 */
export interface MatchOdds {
  homeOdds: number
  drawOdds: number
  awayOdds: number
}

/**
 * Fair probabilities with margin removed
 */
export interface FairProbabilities {
  homeProbability: number
  drawProbability: number
  awayProbability: number
  margin: number // Overround as decimal (e.g., 0.05 = 5%)
}

/**
 * Dixon-Coles model output
 */
export interface DixonColesResult {
  homeWinProb: number
  drawProb: number
  awayWinProb: number
  expectedHomeGoals: number // λ_home
  expectedAwayGoals: number // λ_away
}

/**
 * Expected Value calculation for each outcome
 */
export interface ExpectedValues {
  evHome: number // (modelProb * odds) - 1
  evDraw: number
  evAway: number
  bestValueOutcome: Outcome | null // Outcome with highest positive EV, or null
}

/**
 * Form metrics using EMA
 */
export interface FormMetrics {
  emaForm: number // 0-1 score based on recent results
  xgTrend: number | null // xG differential trend (can be null if no xG data)
  regressionFlag: RegressionFlag
}

/**
 * Match result for Elo updates
 */
export interface MatchResult {
  homeTeamId: number
  awayTeamId: number
  homeGoals: number
  awayGoals: number
  homeXg?: number
  awayXg?: number
  matchDate: Date
}

/**
 * Recent match data for form calculation
 */
export interface RecentMatch {
  teamId: number
  opponentId: number
  goalsFor: number
  goalsAgainst: number
  xgFor: number | null
  xgAgainst: number | null
  isHome: boolean
  matchDate: Date
  outcome: 'W' | 'D' | 'L'
}

/**
 * Full match calculations to store in database
 */
export interface MatchCalculations {
  matchId: number

  // Dixon-Coles model
  modelProbHome: number
  modelProbDraw: number
  modelProbAway: number
  expectedHomeGoals: number
  expectedAwayGoals: number

  // Fair probabilities
  fairProbHome: number
  fairProbDraw: number
  fairProbAway: number
  bookmakerMargin: number

  // Expected Values
  evHome: number
  evDraw: number
  evAway: number
  bestValueOutcome: Outcome | null

  // Form metrics
  homeFormEma: number | null
  awayFormEma: number | null
  homeXgTrend: number | null
  awayXgTrend: number | null
  homeRegressionFlag: RegressionFlag
  awayRegressionFlag: RegressionFlag

  // Contextual
  homeRestDays: number | null
  awayRestDays: number | null
  importanceScore: number | null

  // Metadata
  dataQuality: DataQuality
  modelVersion: string
}

/**
 * Configuration for the statistical model
 */
export interface ModelConfig {
  // Dixon-Coles parameters
  rho: number // Low-score correlation parameter (typically -0.1 to -0.05)
  homeAdvantage: number // Home field advantage multiplier (typically 1.2-1.4)
  maxGoals: number // Maximum goals to consider in probability sum

  // Elo parameters
  kFactor: number // How much each match affects rating (typically 20-32)
  marginMultiplier: number // Extra K adjustment for goal margin

  // Form parameters
  emaAlpha: number // Smoothing factor for EMA (0.3 = 30% weight on latest)
  formLookback: number // Number of matches to consider

  // Value threshold
  evThreshold: number // Minimum EV to flag as value bet (e.g., 0.03 = 3%)

  // Version
  version: string
}

/**
 * Maximum rest days to consider valid.
 * Values above this indicate the team is new to the system or hasn't
 * been in recent pools - return null instead of misleading large numbers.
 */
export const MAX_REST_DAYS = 90

/**
 * Default model configuration
 */
export const DEFAULT_CONFIG: ModelConfig = {
  // Dixon-Coles
  rho: -0.1, // Slight negative correlation for low-scoring matches
  homeAdvantage: 1.25, // 25% boost for home team
  maxGoals: 10, // Sum probabilities up to 10 goals each

  // Elo
  kFactor: 20,
  marginMultiplier: 0.1,

  // Form
  emaAlpha: 0.3,
  formLookback: 10,

  // Value
  evThreshold: 0.03, // 3% edge required

  // Version
  version: 'v1.0',
}
