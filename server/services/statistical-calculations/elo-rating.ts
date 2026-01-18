/**
 * Elo Rating System for Football Teams
 *
 * Implements a modified Elo rating system with:
 * - Separate attack and defense strength ratings
 * - Goal margin adjustments via K-factor
 * - Home advantage consideration
 *
 * Reference: Arpad Elo's rating system, adapted for football by clubelo.com methodology
 *
 * Formula:
 *   expected = 1 / (1 + 10^((opponentRating - teamRating) / 400))
 *   K = kFactor × (1 + margin × marginMultiplier) × homeAdjustment
 *   newRating = oldRating + K × (actual - expected)
 *
 * where actual = 1 for win, 0.5 for draw, 0 for loss
 */

import { prisma } from '~/server/utils/prisma'
import type { TeamRatings, RatingType, Confidence, MatchResult, ModelConfig } from './types'
import { DEFAULT_RATINGS, DEFAULT_CONFIG } from './types'

/**
 * Get confidence level based on matches played
 */
export function getConfidence(matchesPlayed: number): Confidence {
  if (matchesPlayed >= 15) return 'high'
  if (matchesPlayed >= 5) return 'medium'
  return 'low'
}

/**
 * Calculate expected score using Elo formula
 * @param ratingA - Team A's rating
 * @param ratingB - Team B's rating
 * @returns Expected score for Team A (0-1)
 */
export function calculateExpected(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

/**
 * Calculate K-factor adjustment based on goal margin
 * @param goalMargin - Absolute goal difference
 * @param config - Model configuration
 * @returns Adjusted K-factor
 */
export function calculateKFactor(
  goalMargin: number,
  isHome: boolean,
  config: ModelConfig = DEFAULT_CONFIG
): number {
  // Base K-factor with margin adjustment
  let k = config.kFactor * (1 + goalMargin * config.marginMultiplier)

  // Reduce K for home team wins (expected) and increase for away wins (unexpected)
  if (isHome) {
    k *= 0.9 // Home wins are more expected, less impact
  } else {
    k *= 1.1 // Away wins are less expected, more impact
  }

  return k
}

/**
 * Get actual score value from match result
 * @param goalsFor - Goals scored
 * @param goalsAgainst - Goals conceded
 * @returns 1 for win, 0.5 for draw, 0 for loss
 */
export function getActualScore(goalsFor: number, goalsAgainst: number): number {
  if (goalsFor > goalsAgainst) return 1
  if (goalsFor === goalsAgainst) return 0.5
  return 0
}

/**
 * Initialize ratings for a team
 * @param teamId - Team ID
 * @param modelVersion - Model version string
 */
export async function initializeTeamRatings(
  teamId: number,
  modelVersion: string = DEFAULT_CONFIG.version
): Promise<TeamRatings> {
  const ratingTypes: RatingType[] = ['elo', 'attack', 'defense']

  // Create all three rating types
  for (const ratingType of ratingTypes) {
    const value =
      ratingType === 'elo'
        ? DEFAULT_RATINGS.elo
        : ratingType === 'attack'
          ? DEFAULT_RATINGS.attack
          : DEFAULT_RATINGS.defense

    await prisma.team_ratings.upsert({
      where: {
        team_id_rating_type_model_version: {
          team_id: teamId,
          rating_type: ratingType,
          model_version: modelVersion,
        },
      },
      update: {}, // Don't overwrite existing
      create: {
        team_id: teamId,
        rating_type: ratingType,
        rating_value: value,
        model_version: modelVersion,
        matches_played: 0,
        confidence: 'low',
        last_match_date: null,
      },
    })
  }

  return {
    teamId,
    elo: DEFAULT_RATINGS.elo,
    attack: DEFAULT_RATINGS.attack,
    defense: DEFAULT_RATINGS.defense,
    matchesPlayed: DEFAULT_RATINGS.matchesPlayed,
    confidence: DEFAULT_RATINGS.confidence,
    lastMatchDate: null,
  }
}

/**
 * Get current ratings for a team
 * @param teamId - Team ID
 * @param modelVersion - Model version string
 * @returns Team ratings or default if not found
 */
export async function getTeamRatings(
  teamId: number,
  modelVersion: string = DEFAULT_CONFIG.version
): Promise<TeamRatings> {
  const ratings = await prisma.team_ratings.findMany({
    where: {
      team_id: teamId,
      model_version: modelVersion,
    },
  })

  if (ratings.length === 0) {
    // Initialize if not found
    return initializeTeamRatings(teamId, modelVersion)
  }

  // Build ratings object
  const result: TeamRatings = {
    teamId,
    elo: DEFAULT_RATINGS.elo,
    attack: DEFAULT_RATINGS.attack,
    defense: DEFAULT_RATINGS.defense,
    matchesPlayed: 0,
    confidence: 'low',
    lastMatchDate: null,
  }

  for (const rating of ratings) {
    if (rating.rating_type === 'elo') {
      result.elo = Number(rating.rating_value)
    } else if (rating.rating_type === 'attack') {
      result.attack = Number(rating.rating_value)
    } else if (rating.rating_type === 'defense') {
      result.defense = Number(rating.rating_value)
    }
    result.matchesPlayed = rating.matches_played
    result.confidence = rating.confidence as Confidence
    result.lastMatchDate = rating.last_match_date
  }

  return result
}

/**
 * Update ratings for both teams after a match
 * @param result - Match result with goals and optional xG
 * @param config - Model configuration
 */
export async function updateRatingsAfterMatch(
  result: MatchResult,
  config: ModelConfig = DEFAULT_CONFIG
): Promise<{ home: TeamRatings; away: TeamRatings }> {
  // Get current ratings
  const homeRatings = await getTeamRatings(result.homeTeamId, config.version)
  const awayRatings = await getTeamRatings(result.awayTeamId, config.version)

  // Calculate expected scores
  const homeExpected = calculateExpected(homeRatings.elo, awayRatings.elo)
  const awayExpected = 1 - homeExpected

  // Calculate actual scores
  const homeActual = getActualScore(result.homeGoals, result.awayGoals)
  const awayActual = 1 - homeActual

  // Calculate goal margin
  const goalMargin = Math.abs(result.homeGoals - result.awayGoals)

  // Calculate K-factors
  const homeK = calculateKFactor(goalMargin, true, config)
  const awayK = calculateKFactor(goalMargin, false, config)

  // Update Elo ratings
  const newHomeElo = homeRatings.elo + homeK * (homeActual - homeExpected)
  const newAwayElo = awayRatings.elo + awayK * (awayActual - awayExpected)

  // Update attack/defense based on xG if available, otherwise use goals
  const homeXg = result.homeXg ?? result.homeGoals
  const awayXg = result.awayXg ?? result.awayGoals

  // Attack update: how well team performed vs expected
  // Defense update: how well team prevented goals vs expected
  const leagueAvgGoals = 1.4 // Typical league average goals per team

  const newHomeAttack = homeRatings.attack * 0.95 + (homeXg / leagueAvgGoals) * 0.05
  const newHomeDefense =
    homeRatings.defense * 0.95 + (leagueAvgGoals / Math.max(awayXg, 0.1)) * 0.05
  const newAwayAttack = awayRatings.attack * 0.95 + (awayXg / leagueAvgGoals) * 0.05
  const newAwayDefense =
    awayRatings.defense * 0.95 + (leagueAvgGoals / Math.max(homeXg, 0.1)) * 0.05

  // Update matches played
  const newHomeMatchesPlayed = homeRatings.matchesPlayed + 1
  const newAwayMatchesPlayed = awayRatings.matchesPlayed + 1

  // Determine confidence
  const homeConfidence = getConfidence(newHomeMatchesPlayed)
  const awayConfidence = getConfidence(newAwayMatchesPlayed)

  // Persist updates
  const ratingUpdates = [
    // Home team
    {
      team_id: result.homeTeamId,
      rating_type: 'elo',
      value: newHomeElo,
      matches: newHomeMatchesPlayed,
      confidence: homeConfidence,
    },
    {
      team_id: result.homeTeamId,
      rating_type: 'attack',
      value: Math.max(0.5, Math.min(2.0, newHomeAttack)), // Clamp to reasonable range
      matches: newHomeMatchesPlayed,
      confidence: homeConfidence,
    },
    {
      team_id: result.homeTeamId,
      rating_type: 'defense',
      value: Math.max(0.5, Math.min(2.0, newHomeDefense)),
      matches: newHomeMatchesPlayed,
      confidence: homeConfidence,
    },
    // Away team
    {
      team_id: result.awayTeamId,
      rating_type: 'elo',
      value: newAwayElo,
      matches: newAwayMatchesPlayed,
      confidence: awayConfidence,
    },
    {
      team_id: result.awayTeamId,
      rating_type: 'attack',
      value: Math.max(0.5, Math.min(2.0, newAwayAttack)),
      matches: newAwayMatchesPlayed,
      confidence: awayConfidence,
    },
    {
      team_id: result.awayTeamId,
      rating_type: 'defense',
      value: Math.max(0.5, Math.min(2.0, newAwayDefense)),
      matches: newAwayMatchesPlayed,
      confidence: awayConfidence,
    },
  ]

  // Execute updates
  for (const update of ratingUpdates) {
    await prisma.team_ratings.upsert({
      where: {
        team_id_rating_type_model_version: {
          team_id: update.team_id,
          rating_type: update.rating_type,
          model_version: config.version,
        },
      },
      update: {
        rating_value: update.value,
        matches_played: update.matches,
        confidence: update.confidence,
        last_match_date: result.matchDate,
      },
      create: {
        team_id: update.team_id,
        rating_type: update.rating_type,
        rating_value: update.value,
        model_version: config.version,
        matches_played: update.matches,
        confidence: update.confidence,
        last_match_date: result.matchDate,
      },
    })
  }

  // Return updated ratings
  return {
    home: {
      teamId: result.homeTeamId,
      elo: newHomeElo,
      attack: Math.max(0.5, Math.min(2.0, newHomeAttack)),
      defense: Math.max(0.5, Math.min(2.0, newHomeDefense)),
      matchesPlayed: newHomeMatchesPlayed,
      confidence: homeConfidence,
      lastMatchDate: result.matchDate,
    },
    away: {
      teamId: result.awayTeamId,
      elo: newAwayElo,
      attack: Math.max(0.5, Math.min(2.0, newAwayAttack)),
      defense: Math.max(0.5, Math.min(2.0, newAwayDefense)),
      matchesPlayed: newAwayMatchesPlayed,
      confidence: awayConfidence,
      lastMatchDate: result.matchDate,
    },
  }
}

/**
 * Initialize all existing teams with default ratings
 * Useful for initial setup
 */
export async function initializeAllTeamRatings(
  modelVersion: string = DEFAULT_CONFIG.version
): Promise<number> {
  const teams = await prisma.teams.findMany({ select: { id: true } })

  let count = 0
  for (const team of teams) {
    await initializeTeamRatings(team.id, modelVersion)
    count++
  }

  console.log(`[Elo Rating] Initialized ${count} teams with default ratings (${modelVersion})`)
  return count
}
