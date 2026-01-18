/**
 * Statistical Calculations Service
 *
 * Main orchestration service that:
 * 1. Fetches team ratings
 * 2. Calculates Dixon-Coles probabilities
 * 3. Computes fair odds and EV
 * 4. Calculates form metrics
 * 5. Determines contextual factors
 * 6. Persists all calculations to database
 *
 * This service provides the mathematical foundation for predictions,
 * giving Claude AI a baseline to adjust based on contextual factors.
 */

import { prisma } from '~/server/utils/prisma'
import type { XStatsData } from '~/types'
import { getTeamRatings } from './elo-rating'
import { calculateOutcomeProbabilities } from './dixon-coles'
import { calculateFormMetrics, determineOutcome, type RecentMatch } from './form-calculator'
import { calculateFairProbabilities, calculateExpectedValues } from './value-calculator'
import type { MatchCalculations, DataQuality, TeamRatings, ModelConfig, MatchOdds } from './types'
import { DEFAULT_CONFIG } from './types'

// Re-export sub-modules
export * from './types'
export * from './elo-rating'
export * from './dixon-coles'
export * from './form-calculator'
export * from './value-calculator'

/**
 * Calculate all statistics for a match
 *
 * @param matchId - Match ID
 * @param config - Model configuration
 * @returns Full match calculations or null if insufficient data
 */
export async function calculateMatchStatistics(
  matchId: number,
  config: ModelConfig = DEFAULT_CONFIG
): Promise<MatchCalculations | null> {
  try {
    // Fetch match with related data
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        league: true,
        match_odds: {
          where: { type: 'current' },
          orderBy: { collected_at: 'desc' },
          take: 1,
        },
        draws: true,
      },
    })

    if (!match) {
      console.warn(`[Statistical Calculations] Match ${matchId} not found`)
      return null
    }

    // Track data quality
    let dataQuality: DataQuality = 'full'
    const missingData: string[] = []

    // Get team ratings
    const homeRatings = await getTeamRatings(match.home_team_id, config.version)
    const awayRatings = await getTeamRatings(match.away_team_id, config.version)

    if (homeRatings.confidence === 'low' || awayRatings.confidence === 'low') {
      missingData.push('team_ratings')
    }

    // Calculate Dixon-Coles probabilities
    const dixonColes = calculateOutcomeProbabilities(homeRatings, awayRatings, config)

    // Get odds for fair probability and EV calculation
    let odds: MatchOdds | null = null
    const matchOdds = match.match_odds?.[0]
    if (matchOdds) {
      odds = {
        homeOdds: Number(matchOdds.home_odds),
        drawOdds: Number(matchOdds.draw_odds),
        awayOdds: Number(matchOdds.away_odds),
      }
    }

    // Calculate fair probabilities and EV (or use model probs if no odds)
    let fairProbs = {
      homeProbability: dixonColes.homeWinProb,
      drawProbability: dixonColes.drawProb,
      awayProbability: dixonColes.awayWinProb,
      margin: 0,
    }

    let expectedValues = {
      evHome: 0,
      evDraw: 0,
      evAway: 0,
      bestValueOutcome: null as '1' | 'X' | '2' | null,
    }

    if (odds) {
      fairProbs = calculateFairProbabilities(odds)
      expectedValues = calculateExpectedValues(
        {
          homeProb: dixonColes.homeWinProb,
          drawProb: dixonColes.drawProb,
          awayProb: dixonColes.awayWinProb,
        },
        odds,
        config
      )
    } else {
      missingData.push('odds')
    }

    // Calculate form metrics
    const homeForm = await calculateTeamFormMetrics(match.home_team_id, match.start_time, config)
    const awayForm = await calculateTeamFormMetrics(match.away_team_id, match.start_time, config)

    if (!homeForm || !awayForm) {
      missingData.push('form_data')
    }

    // Calculate contextual factors
    const homeRestDays = await calculateRestDays(match.home_team_id, match.start_time)
    const awayRestDays = await calculateRestDays(match.away_team_id, match.start_time)

    // Calculate importance score (simplified - could be enhanced)
    const importanceScore = await calculateImportanceScore(
      match.home_team_id,
      match.away_team_id,
      match.league_id
    )

    // Determine final data quality
    if (missingData.length === 0) {
      dataQuality = 'full'
    } else if (missingData.length <= 2) {
      dataQuality = 'partial'
    } else {
      dataQuality = 'minimal'
    }

    // Build calculations object
    const calculations: MatchCalculations = {
      matchId,

      // Dixon-Coles
      modelProbHome: dixonColes.homeWinProb,
      modelProbDraw: dixonColes.drawProb,
      modelProbAway: dixonColes.awayWinProb,
      expectedHomeGoals: dixonColes.expectedHomeGoals,
      expectedAwayGoals: dixonColes.expectedAwayGoals,

      // Fair probabilities
      fairProbHome: fairProbs.homeProbability,
      fairProbDraw: fairProbs.drawProbability,
      fairProbAway: fairProbs.awayProbability,
      bookmakerMargin: fairProbs.margin,

      // Expected Values
      evHome: expectedValues.evHome,
      evDraw: expectedValues.evDraw,
      evAway: expectedValues.evAway,
      bestValueOutcome: expectedValues.bestValueOutcome,

      // Form metrics
      homeFormEma: homeForm?.emaForm ?? null,
      awayFormEma: awayForm?.emaForm ?? null,
      homeXgTrend: homeForm?.xgTrend ?? null,
      awayXgTrend: awayForm?.xgTrend ?? null,
      homeRegressionFlag: homeForm?.regressionFlag ?? null,
      awayRegressionFlag: awayForm?.regressionFlag ?? null,

      // Contextual
      homeRestDays,
      awayRestDays,
      importanceScore,

      // Metadata
      dataQuality,
      modelVersion: config.version,
    }

    // Persist to database
    await saveCalculations(calculations)

    console.log(
      `[Statistical Calculations] Calculated match ${matchId}: ` +
        `model=${(dixonColes.homeWinProb * 100).toFixed(1)}%/${(dixonColes.drawProb * 100).toFixed(1)}%/${(dixonColes.awayWinProb * 100).toFixed(1)}%, ` +
        `quality=${dataQuality}`
    )

    return calculations
  } catch (error) {
    console.error(`[Statistical Calculations] Error calculating match ${matchId}:`, error)
    return null
  }
}

/**
 * Calculate form metrics for a team
 */
async function calculateTeamFormMetrics(teamId: number, beforeDate: Date, config: ModelConfig) {
  const recentMatches = await getRecentMatchesForTeam(teamId, beforeDate, config.formLookback)

  if (recentMatches.length < 3) {
    return null // Need at least 3 matches for meaningful form
  }

  return calculateFormMetrics(recentMatches, config)
}

/**
 * Get recent matches for a team (for form calculation)
 */
async function getRecentMatchesForTeam(
  teamId: number,
  beforeDate: Date,
  limit: number
): Promise<RecentMatch[]> {
  // Get completed matches for this team before the given date
  const matches = await prisma.matches.findMany({
    where: {
      OR: [{ home_team_id: teamId }, { away_team_id: teamId }],
      start_time: { lt: beforeDate },
      outcome: { not: null }, // Only completed matches
    },
    orderBy: { start_time: 'desc' },
    take: limit,
    include: {
      match_scraped_data: {
        where: { data_type: 'xStats' },
      },
    },
  })

  return matches.map(match => {
    const isHome = match.home_team_id === teamId
    const goalsFor = isHome ? match.result_home! : match.result_away!
    const goalsAgainst = isHome ? match.result_away! : match.result_home!

    // Extract xG from scraped data if available
    let xgFor: number | null = null
    let xgAgainst: number | null = null

    const xStats = match.match_scraped_data.find(d => d.data_type === 'xStats')
    if (xStats?.data) {
      const data = xStats.data as unknown as XStatsData
      if (isHome) {
        xgFor = data.homeTeam?.entireSeason?.xg ? parseFloat(data.homeTeam.entireSeason.xg) : null
        xgAgainst = data.awayTeam?.entireSeason?.xg
          ? parseFloat(data.awayTeam.entireSeason.xg)
          : null
      } else {
        xgFor = data.awayTeam?.entireSeason?.xg ? parseFloat(data.awayTeam.entireSeason.xg) : null
        xgAgainst = data.homeTeam?.entireSeason?.xg
          ? parseFloat(data.homeTeam.entireSeason.xg)
          : null
      }
    }

    return {
      teamId,
      opponentId: isHome ? match.away_team_id : match.home_team_id,
      goalsFor,
      goalsAgainst,
      xgFor,
      xgAgainst,
      isHome,
      matchDate: match.start_time,
      outcome: determineOutcome(goalsFor, goalsAgainst),
    }
  })
}

/**
 * Calculate rest days since last match
 */
async function calculateRestDays(teamId: number, matchDate: Date): Promise<number | null> {
  const lastMatch = await prisma.matches.findFirst({
    where: {
      OR: [{ home_team_id: teamId }, { away_team_id: teamId }],
      start_time: { lt: matchDate },
      outcome: { not: null },
    },
    orderBy: { start_time: 'desc' },
  })

  if (!lastMatch) return null

  const diffMs = matchDate.getTime() - lastMatch.start_time.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Calculate match importance score (0-1)
 * Based on league position stakes (title race, relegation, etc.)
 *
 * This is a simplified version - could be enhanced with actual table data
 */
async function calculateImportanceScore(
  _homeTeamId: number,
  _awayTeamId: number,
  _leagueId: number
): Promise<number | null> {
  // TODO: Implement actual importance calculation based on:
  // - League position
  // - Remaining matches
  // - Points to title/relegation/European spots

  // For now, return a default moderate importance
  return 0.5
}

/**
 * Save calculations to database
 */
async function saveCalculations(calculations: MatchCalculations): Promise<void> {
  await prisma.match_calculations.upsert({
    where: { match_id: calculations.matchId },
    update: {
      model_prob_home: calculations.modelProbHome,
      model_prob_draw: calculations.modelProbDraw,
      model_prob_away: calculations.modelProbAway,
      expected_home_goals: calculations.expectedHomeGoals,
      expected_away_goals: calculations.expectedAwayGoals,
      fair_prob_home: calculations.fairProbHome,
      fair_prob_draw: calculations.fairProbDraw,
      fair_prob_away: calculations.fairProbAway,
      bookmaker_margin: calculations.bookmakerMargin,
      ev_home: calculations.evHome,
      ev_draw: calculations.evDraw,
      ev_away: calculations.evAway,
      best_value_outcome: calculations.bestValueOutcome,
      home_form_ema: calculations.homeFormEma,
      away_form_ema: calculations.awayFormEma,
      home_xg_trend: calculations.homeXgTrend,
      away_xg_trend: calculations.awayXgTrend,
      home_regression_flag: calculations.homeRegressionFlag,
      away_regression_flag: calculations.awayRegressionFlag,
      home_rest_days: calculations.homeRestDays,
      away_rest_days: calculations.awayRestDays,
      importance_score: calculations.importanceScore,
      data_quality: calculations.dataQuality,
      model_version: calculations.modelVersion,
      calculated_at: new Date(),
    },
    create: {
      match_id: calculations.matchId,
      model_prob_home: calculations.modelProbHome,
      model_prob_draw: calculations.modelProbDraw,
      model_prob_away: calculations.modelProbAway,
      expected_home_goals: calculations.expectedHomeGoals,
      expected_away_goals: calculations.expectedAwayGoals,
      fair_prob_home: calculations.fairProbHome,
      fair_prob_draw: calculations.fairProbDraw,
      fair_prob_away: calculations.fairProbAway,
      bookmaker_margin: calculations.bookmakerMargin,
      ev_home: calculations.evHome,
      ev_draw: calculations.evDraw,
      ev_away: calculations.evAway,
      best_value_outcome: calculations.bestValueOutcome,
      home_form_ema: calculations.homeFormEma,
      away_form_ema: calculations.awayFormEma,
      home_xg_trend: calculations.homeXgTrend,
      away_xg_trend: calculations.awayXgTrend,
      home_regression_flag: calculations.homeRegressionFlag,
      away_regression_flag: calculations.awayRegressionFlag,
      home_rest_days: calculations.homeRestDays,
      away_rest_days: calculations.awayRestDays,
      importance_score: calculations.importanceScore,
      data_quality: calculations.dataQuality,
      model_version: calculations.modelVersion,
    },
  })
}

/**
 * Get stored calculations for a match
 */
export async function getMatchCalculations(matchId: number): Promise<MatchCalculations | null> {
  const calc = await prisma.match_calculations.findUnique({
    where: { match_id: matchId },
  })

  if (!calc) return null

  return {
    matchId: calc.match_id,
    modelProbHome: Number(calc.model_prob_home),
    modelProbDraw: Number(calc.model_prob_draw),
    modelProbAway: Number(calc.model_prob_away),
    expectedHomeGoals: Number(calc.expected_home_goals),
    expectedAwayGoals: Number(calc.expected_away_goals),
    fairProbHome: Number(calc.fair_prob_home),
    fairProbDraw: Number(calc.fair_prob_draw),
    fairProbAway: Number(calc.fair_prob_away),
    bookmakerMargin: Number(calc.bookmaker_margin),
    evHome: Number(calc.ev_home),
    evDraw: Number(calc.ev_draw),
    evAway: Number(calc.ev_away),
    bestValueOutcome: calc.best_value_outcome as '1' | 'X' | '2' | null,
    homeFormEma: calc.home_form_ema ? Number(calc.home_form_ema) : null,
    awayFormEma: calc.away_form_ema ? Number(calc.away_form_ema) : null,
    homeXgTrend: calc.home_xg_trend ? Number(calc.home_xg_trend) : null,
    awayXgTrend: calc.away_xg_trend ? Number(calc.away_xg_trend) : null,
    homeRegressionFlag: calc.home_regression_flag as 'overperforming' | 'underperforming' | null,
    awayRegressionFlag: calc.away_regression_flag as 'overperforming' | 'underperforming' | null,
    homeRestDays: calc.home_rest_days,
    awayRestDays: calc.away_rest_days,
    importanceScore: calc.importance_score ? Number(calc.importance_score) : null,
    dataQuality: calc.data_quality as DataQuality,
    modelVersion: calc.model_version,
  }
}

/**
 * Calculate statistics for all matches in a draw
 */
export async function calculateDrawStatistics(
  drawId: number,
  config: ModelConfig = DEFAULT_CONFIG
): Promise<{ calculated: number; failed: number }> {
  const matches = await prisma.matches.findMany({
    where: { draw_id: drawId },
    select: { id: true },
  })

  let calculated = 0
  let failed = 0

  for (const match of matches) {
    const result = await calculateMatchStatistics(match.id, config)
    if (result) {
      calculated++
    } else {
      failed++
    }
  }

  console.log(
    `[Statistical Calculations] Draw ${drawId}: ${calculated} calculated, ${failed} failed`
  )

  return { calculated, failed }
}

/**
 * Check if calculations exist for a match
 */
export async function hasCalculations(matchId: number): Promise<boolean> {
  const calc = await prisma.match_calculations.findUnique({
    where: { match_id: matchId },
    select: { id: true },
  })
  return calc !== null
}

/**
 * Get calculation status for a draw
 */
export async function getDrawCalculationStatus(drawId: number): Promise<{
  total: number
  calculated: number
  pending: number
  matches: Array<{ matchId: number; hasCalculation: boolean }>
}> {
  const matches = await prisma.matches.findMany({
    where: { draw_id: drawId },
    select: {
      id: true,
      match_calculations: { select: { id: true } },
    },
  })

  const matchStatuses = matches.map(m => ({
    matchId: m.id,
    hasCalculation: m.match_calculations !== null,
  }))

  const calculated = matchStatuses.filter(m => m.hasCalculation).length

  return {
    total: matches.length,
    calculated,
    pending: matches.length - calculated,
    matches: matchStatuses,
  }
}

/**
 * Recalculate statistics for matches that need updates
 * Only recalculates if:
 * - No calculations exist, OR
 * - forceRecalculate is true
 */
export async function recalculateDrawStatistics(
  drawId: number,
  options: { forceRecalculate?: boolean; config?: ModelConfig } = {}
): Promise<{ calculated: number; skipped: number; failed: number }> {
  const { forceRecalculate = false, config = DEFAULT_CONFIG } = options

  const matches = await prisma.matches.findMany({
    where: { draw_id: drawId },
    select: {
      id: true,
      match_calculations: { select: { id: true } },
    },
  })

  let calculated = 0
  let skipped = 0
  let failed = 0

  for (const match of matches) {
    // Skip if already calculated and not forcing recalculation
    if (match.match_calculations && !forceRecalculate) {
      skipped++
      continue
    }

    const result = await calculateMatchStatistics(match.id, config)
    if (result) {
      calculated++
    } else {
      failed++
    }
  }

  console.log(
    `[Statistical Calculations] Draw ${drawId}: ${calculated} calculated, ${skipped} skipped, ${failed} failed`
  )

  return { calculated, skipped, failed }
}

/**
 * Update team ratings after a match completes
 * Called when match results are finalized (status = 'FT')
 *
 * @param matchId - Match ID
 * @param config - Model configuration
 * @returns Updated ratings for both teams or null if match not eligible
 */
export async function updateRatingsForCompletedMatch(
  matchId: number,
  config: ModelConfig = DEFAULT_CONFIG
): Promise<{ home: TeamRatings; away: TeamRatings } | null> {
  try {
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        match_scraped_data: {
          where: { data_type: 'xStats' },
        },
      },
    })

    if (!match) {
      console.warn(`[Statistical Calculations] Match ${matchId} not found for rating update`)
      return null
    }

    // Only update ratings for completed matches with results
    if (match.result_home === null || match.result_away === null) {
      console.log(
        `[Statistical Calculations] Match ${matchId} has no result yet, skipping rating update`
      )
      return null
    }

    // Extract xG if available
    let homeXg: number | undefined
    let awayXg: number | undefined

    const xStats = match.match_scraped_data.find(d => d.data_type === 'xStats')
    if (xStats?.data) {
      const data = xStats.data as Record<string, unknown>
      const homeTeamData = data.homeTeam as Record<string, unknown> | undefined
      const awayTeamData = data.awayTeam as Record<string, unknown> | undefined
      const homeEntireSeason = homeTeamData?.entireSeason as Record<string, unknown> | undefined
      const awayEntireSeason = awayTeamData?.entireSeason as Record<string, unknown> | undefined

      if (homeEntireSeason?.xg) {
        homeXg = parseFloat(String(homeEntireSeason.xg))
      }
      if (awayEntireSeason?.xg) {
        awayXg = parseFloat(String(awayEntireSeason.xg))
      }
    }

    // Import and call the rating update function
    const { updateRatingsAfterMatch } = await import('./elo-rating')

    const result = await updateRatingsAfterMatch(
      {
        homeTeamId: match.home_team_id,
        awayTeamId: match.away_team_id,
        homeGoals: match.result_home,
        awayGoals: match.result_away,
        homeXg,
        awayXg,
        matchDate: match.start_time,
      },
      config
    )

    console.log(
      `[Statistical Calculations] Updated ratings for match ${matchId}: ` +
        `home=${result.home.elo.toFixed(0)} (${result.home.confidence}), ` +
        `away=${result.away.elo.toFixed(0)} (${result.away.confidence})`
    )

    return result
  } catch (error) {
    console.error(`[Statistical Calculations] Error updating ratings for match ${matchId}:`, error)
    return null
  }
}
