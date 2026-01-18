import { prisma } from '~/server/utils/prisma'

/**
 * GET /api/matches/:id/calculations
 * Returns match calculations (Dixon-Coles probs, EVs, form metrics) and team ratings
 */
export default defineEventHandler(async event => {
  const matchId = parseInt(event.context.params?.id || '0')

  if (!matchId || isNaN(matchId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid match ID',
    })
  }

  // Fetch match with calculations and team info
  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    include: {
      match_calculations: true,
      homeTeam: {
        include: {
          team_ratings: {
            where: { model_version: 'v1.0' },
          },
        },
      },
      awayTeam: {
        include: {
          team_ratings: {
            where: { model_version: 'v1.0' },
          },
        },
      },
      match_odds: {
        where: { type: 'current' },
        take: 1,
        orderBy: { collected_at: 'desc' },
      },
    },
  })

  if (!match) {
    throw createError({
      statusCode: 404,
      message: 'Match not found',
    })
  }

  // Transform team ratings into a cleaner format
  const transformRatings = (ratings: typeof match.homeTeam.team_ratings) => {
    const elo = ratings.find(r => r.rating_type === 'elo')
    const attack = ratings.find(r => r.rating_type === 'attack')
    const defense = ratings.find(r => r.rating_type === 'defense')

    if (!elo) return null

    return {
      elo: Number(elo.rating_value),
      attack: attack ? Number(attack.rating_value) : 1.0,
      defense: defense ? Number(defense.rating_value) : 1.0,
      matchesPlayed: elo.matches_played,
      confidence: elo.confidence,
      lastMatchDate: elo.last_match_date,
    }
  }

  // Get market probabilities from odds
  const odds = match.match_odds[0]
  const marketProbs = odds
    ? {
        home: Number(odds.home_probability) / 100,
        draw: Number(odds.draw_probability) / 100,
        away: Number(odds.away_probability) / 100,
      }
    : null

  const calculations = match.match_calculations
  if (!calculations) {
    return {
      success: true,
      data: null,
      homeTeamRatings: transformRatings(match.homeTeam.team_ratings),
      awayTeamRatings: transformRatings(match.awayTeam.team_ratings),
      marketProbabilities: marketProbs,
      message: 'Calculations not available for this match',
    }
  }

  return {
    success: true,
    data: {
      matchId: calculations.match_id,
      // Dixon-Coles model outputs
      modelProbabilities: {
        home: Number(calculations.model_prob_home),
        draw: Number(calculations.model_prob_draw),
        away: Number(calculations.model_prob_away),
      },
      expectedGoals: {
        home: Number(calculations.expected_home_goals),
        away: Number(calculations.expected_away_goals),
      },
      // Fair probabilities
      fairProbabilities: {
        home: Number(calculations.fair_prob_home),
        draw: Number(calculations.fair_prob_draw),
        away: Number(calculations.fair_prob_away),
      },
      bookmakerMargin: Number(calculations.bookmaker_margin),
      // Expected values
      expectedValues: {
        home: Number(calculations.ev_home),
        draw: Number(calculations.ev_draw),
        away: Number(calculations.ev_away),
      },
      bestValueOutcome: calculations.best_value_outcome,
      // Form metrics
      form: {
        home: {
          ema: calculations.home_form_ema ? Number(calculations.home_form_ema) : null,
          xgTrend: calculations.home_xg_trend ? Number(calculations.home_xg_trend) : null,
          regressionFlag: calculations.home_regression_flag,
        },
        away: {
          ema: calculations.away_form_ema ? Number(calculations.away_form_ema) : null,
          xgTrend: calculations.away_xg_trend ? Number(calculations.away_xg_trend) : null,
          regressionFlag: calculations.away_regression_flag,
        },
      },
      // Contextual factors
      context: {
        homeRestDays: calculations.home_rest_days,
        awayRestDays: calculations.away_rest_days,
        importanceScore: calculations.importance_score
          ? Number(calculations.importance_score)
          : null,
      },
      // Metadata
      dataQuality: calculations.data_quality,
      modelVersion: calculations.model_version,
      calculatedAt: calculations.calculated_at,
    },
    homeTeamRatings: transformRatings(match.homeTeam.team_ratings),
    awayTeamRatings: transformRatings(match.awayTeam.team_ratings),
    marketProbabilities: marketProbs,
  }
})
