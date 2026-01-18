import { prisma } from '~/server/utils/prisma'
import { Anthropic } from '@anthropic-ai/sdk'
import { embeddingsService } from './embeddings-service'
import { recordAIUsage } from '~/server/utils/ai-usage-recorder'
import { captureAIError } from '~/server/utils/bugsnag-helpers'
import type { PredictionData, PredictionModel } from '~/types'
import { calculateAICost } from '~/server/constants/ai-pricing'
import { getMatchCalculations, type MatchCalculations } from './statistical-calculations'

/* eslint-disable @typescript-eslint/no-explicit-any -- Complex Prisma and AI API data */

/**
 * Options for generating a prediction
 */
export interface PredictMatchOptions {
  userId?: string
  userContext?: string
  isReevaluation?: boolean
  model?: PredictionModel
  gameType?: string
}

/**
 * Service for generating AI-powered match predictions
 */
export class PredictionService {
  private anthropic: Anthropic | null = null

  /**
   * Lazily initialize and return Anthropic client
   */
  private getAnthropicClient(): Anthropic {
    if (!this.anthropic) {
      const apiKey = useRuntimeConfig().anthropicApiKey
      if (!apiKey) {
        throw new Error('Anthropic API key not configured')
      }
      this.anthropic = new Anthropic({ apiKey })
    }
    return this.anthropic
  }

  /**
   * Generate prediction for a match
   */
  async predictMatch(
    matchId: number,
    options: PredictMatchOptions = {}
  ): Promise<PredictionData | null> {
    const {
      userId,
      userContext,
      isReevaluation = false,
      model = 'claude-sonnet-4-5',
      gameType = 'stryktipset',
    } = options

    try {
      console.log(
        `[Prediction Service] ${isReevaluation ? 'Re-evaluating' : 'Generating prediction for'} match ${matchId}`
      )

      // Fetch match data
      const match = await prisma.matches.findUnique({
        where: { id: matchId },
        include: {
          draws: true,
          homeTeam: true,
          awayTeam: true,
          league: {
            include: {
              country: true,
            },
          },
          match_odds: {
            where: { type: 'current' },
            orderBy: { collected_at: 'desc' },
            take: 1,
          },
          match_scraped_data: true,
        },
      })

      if (!match) {
        throw new Error(`Match ${matchId} not found`)
      }

      // Generate embedding first (if not exists)
      try {
        await embeddingsService.generateMatchEmbedding(matchId)
      } catch (error) {
        console.warn('[Prediction Service] Could not generate embedding:', error)
      }

      // Find similar historical matches
      const similarMatches = await embeddingsService.findSimilarMatches(matchId, 10)
      const teamMatchups = await embeddingsService.findSimilarTeamMatchups(
        match.home_team_id,
        match.away_team_id,
        5
      )

      // Fetch statistical calculations (Dixon-Coles probabilities, EV, form metrics)
      const calculations = await getMatchCalculations(matchId)

      // Prepare context for Claude
      const context = this.prepareMatchContext(
        match,
        similarMatches,
        teamMatchups,
        userContext,
        calculations
      )

      // Generate prediction using Claude with game-specific prompt
      const prediction = await this.generatePrediction(context, matchId, model, userId, gameType)

      if (!prediction) {
        throw new Error('Failed to generate prediction')
      }

      // Save prediction to database
      await this.savePrediction(matchId, prediction, { userContext, isReevaluation })

      console.log(
        `[Prediction Service] Successfully ${isReevaluation ? 're-evaluated' : 'generated prediction for'} match ${matchId}`
      )
      return prediction
    } catch (error) {
      console.error(`[Prediction Service] Error predicting match ${matchId}:`, error)
      return null
    }
  }

  /**
   * Prepare context for Claude
   */
  private prepareMatchContext(
    match: any,
    similarMatches: any[],
    teamMatchups: any[],
    userContext?: string,
    calculations?: MatchCalculations | null
  ): string {
    const parts: string[] = []

    // User-provided context (placed first for emphasis)
    if (userContext && userContext.trim()) {
      parts.push('USER-PROVIDED CONTEXT')
      parts.push('=====================')
      parts.push('The user has provided the following additional context for this match:')
      parts.push('')
      parts.push(userContext.trim())
      parts.push('')
      parts.push('IMPORTANT: Consider this user-provided information carefully in your analysis.')
      parts.push('If it significantly impacts your prediction (e.g., key player injuries,')
      parts.push('tactical changes, recent news), adjust your probabilities accordingly.')
      parts.push('')
      parts.push('')
    }

    // Statistical Model Baseline (Dixon-Coles probabilities, EV, form metrics)
    if (calculations) {
      parts.push('STATISTICAL MODEL BASELINE')
      parts.push('=========================')
      parts.push(
        'The following probabilities are calculated using the Dixon-Coles bivariate Poisson model,'
      )
      parts.push(
        'which incorporates team Elo ratings, attack/defense strengths, and home advantage.'
      )
      parts.push('Use these as a mathematical baseline, then adjust based on contextual factors.')
      parts.push('')
      parts.push(`Model Probabilities (Dixon-Coles):`)
      parts.push(`  Home Win (1): ${(calculations.modelProbHome * 100).toFixed(1)}%`)
      parts.push(`  Draw (X): ${(calculations.modelProbDraw * 100).toFixed(1)}%`)
      parts.push(`  Away Win (2): ${(calculations.modelProbAway * 100).toFixed(1)}%`)
      parts.push('')
      parts.push(`Expected Goals:`)
      parts.push(`  ${match.homeTeam.name}: ${calculations.expectedHomeGoals.toFixed(2)} xG`)
      parts.push(`  ${match.awayTeam.name}: ${calculations.expectedAwayGoals.toFixed(2)} xG`)
      parts.push('')

      // Fair probabilities from odds (margin removed)
      if (calculations.bookmakerMargin > 0) {
        parts.push(
          `Fair Probabilities (Odds with ${(calculations.bookmakerMargin * 100).toFixed(1)}% margin removed):`
        )
        parts.push(`  Home Win (1): ${(calculations.fairProbHome * 100).toFixed(1)}%`)
        parts.push(`  Draw (X): ${(calculations.fairProbDraw * 100).toFixed(1)}%`)
        parts.push(`  Away Win (2): ${(calculations.fairProbAway * 100).toFixed(1)}%`)
        parts.push('')

        // Model vs market disagreement
        const homeDisagreement = Math.abs(calculations.modelProbHome - calculations.fairProbHome)
        const drawDisagreement = Math.abs(calculations.modelProbDraw - calculations.fairProbDraw)
        const awayDisagreement = Math.abs(calculations.modelProbAway - calculations.fairProbAway)

        if (homeDisagreement > 0.1 || drawDisagreement > 0.1 || awayDisagreement > 0.1) {
          parts.push('⚠️ MODEL DISAGREES WITH MARKET:')
          if (homeDisagreement > 0.1) {
            const direction =
              calculations.modelProbHome > calculations.fairProbHome ? 'higher' : 'lower'
            parts.push(
              `  Model rates home win ${(homeDisagreement * 100).toFixed(1)}% ${direction} than market`
            )
          }
          if (drawDisagreement > 0.1) {
            const direction =
              calculations.modelProbDraw > calculations.fairProbDraw ? 'higher' : 'lower'
            parts.push(
              `  Model rates draw ${(drawDisagreement * 100).toFixed(1)}% ${direction} than market`
            )
          }
          if (awayDisagreement > 0.1) {
            const direction =
              calculations.modelProbAway > calculations.fairProbAway ? 'higher' : 'lower'
            parts.push(
              `  Model rates away win ${(awayDisagreement * 100).toFixed(1)}% ${direction} than market`
            )
          }
          parts.push('')
        }
      }

      // Expected Value analysis
      if (calculations.evHome !== 0 || calculations.evDraw !== 0 || calculations.evAway !== 0) {
        parts.push(`Expected Value (EV = model_prob × odds - 1):`)
        parts.push(
          `  EV Home: ${calculations.evHome > 0 ? '+' : ''}${(calculations.evHome * 100).toFixed(1)}%`
        )
        parts.push(
          `  EV Draw: ${calculations.evDraw > 0 ? '+' : ''}${(calculations.evDraw * 100).toFixed(1)}%`
        )
        parts.push(
          `  EV Away: ${calculations.evAway > 0 ? '+' : ''}${(calculations.evAway * 100).toFixed(1)}%`
        )

        // Highlight value opportunities (EV > 5%)
        if (calculations.bestValueOutcome) {
          const bestEV =
            calculations.bestValueOutcome === '1'
              ? calculations.evHome
              : calculations.bestValueOutcome === 'X'
                ? calculations.evDraw
                : calculations.evAway
          if (bestEV > 0.05) {
            parts.push('')
            parts.push(
              `💰 VALUE OPPORTUNITY: ${calculations.bestValueOutcome} has +${(bestEV * 100).toFixed(1)}% expected value`
            )
          }
        }
        parts.push('')
      }

      // Form metrics
      if (calculations.homeFormEma !== null || calculations.awayFormEma !== null) {
        parts.push(`Form Metrics (EMA weighted):`)
        if (calculations.homeFormEma !== null) {
          parts.push(
            `  ${match.homeTeam.name}: ${(calculations.homeFormEma * 100).toFixed(0)}% form`
          )
        }
        if (calculations.awayFormEma !== null) {
          parts.push(
            `  ${match.awayTeam.name}: ${(calculations.awayFormEma * 100).toFixed(0)}% form`
          )
        }
        parts.push('')
      }

      // xG trend (regression candidates)
      if (calculations.homeXgTrend !== null || calculations.awayXgTrend !== null) {
        parts.push(`xG Trend (last 5 games):`)
        if (calculations.homeXgTrend !== null) {
          const trend = calculations.homeXgTrend > 0 ? '+' : ''
          parts.push(
            `  ${match.homeTeam.name}: ${trend}${calculations.homeXgTrend.toFixed(2)} xGD/game`
          )
        }
        if (calculations.awayXgTrend !== null) {
          const trend = calculations.awayXgTrend > 0 ? '+' : ''
          parts.push(
            `  ${match.awayTeam.name}: ${trend}${calculations.awayXgTrend.toFixed(2)} xGD/game`
          )
        }
        parts.push('')
      }

      // Regression warnings
      if (calculations.homeRegressionFlag || calculations.awayRegressionFlag) {
        parts.push('⚠️ REGRESSION WARNING:')
        if (calculations.homeRegressionFlag) {
          parts.push(
            `  ${match.homeTeam.name} is ${calculations.homeRegressionFlag} their xG - expect regression`
          )
        }
        if (calculations.awayRegressionFlag) {
          parts.push(
            `  ${match.awayTeam.name} is ${calculations.awayRegressionFlag} their xG - expect regression`
          )
        }
        parts.push('')
      }

      // Contextual factors
      if (calculations.homeRestDays !== null || calculations.awayRestDays !== null) {
        parts.push(`Rest Days:`)
        if (calculations.homeRestDays !== null) {
          const fatigueWarning = calculations.homeRestDays < 3 ? ' ⚠️ FATIGUE RISK' : ''
          parts.push(`  ${match.homeTeam.name}: ${calculations.homeRestDays} days${fatigueWarning}`)
        }
        if (calculations.awayRestDays !== null) {
          const fatigueWarning = calculations.awayRestDays < 3 ? ' ⚠️ FATIGUE RISK' : ''
          parts.push(`  ${match.awayTeam.name}: ${calculations.awayRestDays} days${fatigueWarning}`)
        }
        parts.push('')
      }

      // Data quality indicator
      parts.push(
        `Data Quality: ${calculations.dataQuality} (model version: ${calculations.modelVersion})`
      )
      parts.push('')
      parts.push('')
    }

    // Data interpretation guide
    parts.push('DATA INTERPRETATION GUIDE')
    parts.push('=========================')
    parts.push(
      '- ODDS: Lower odds = higher probability (e.g., 1.50 = ~67%, 5.00 = ~20%). Formula: probability = 1/odds'
    )
    parts.push(
      '- TIO TIDNINGARS TIPS: Count out of 10 newspaper experts picking each outcome (not percentages). If 8/10 pick "1", that outcome is strongly favored by experts.'
    )
    parts.push('- SVENSKA FOLKET: Percentages showing current public betting distribution')
    parts.push(
      '- HOME TEAM is always listed first (1 = home win, X = draw, 2 = away win). Lower home odds = home team favored'
    )
    parts.push(
      '- DATA QUALITY: If odds and expert consensus strongly conflict (e.g., odds suggest 1% chance but 10/10 experts pick that outcome), treat the expert consensus as more reliable - odds data may be corrupted or from a different source.'
    )
    parts.push('')

    // Match information
    parts.push('MATCH INFORMATION')
    parts.push('=================')
    parts.push(`Home Team: ${match.homeTeam.name}`)
    parts.push(`Away Team: ${match.awayTeam.name}`)
    parts.push(`League: ${match.league.name || 'Unknown'}`)
    parts.push(`Country: ${match.league.country?.name || 'Unknown'}`)
    parts.push(`Match Date: ${new Date(match.start_time).toISOString().split('T')[0]}`)
    parts.push('')

    // Odds information
    if (match.match_odds && match.match_odds.length > 0) {
      const odds = match.match_odds[0]
      parts.push('ODDS & MARKET SENTIMENT')
      parts.push('======================')
      parts.push(`Home Win (1): ${odds.home_odds} (${odds.home_probability}%)`)
      parts.push(`Draw (X): ${odds.draw_odds} (${odds.draw_probability}%)`)
      parts.push(`Away Win (2): ${odds.away_odds} (${odds.away_probability}%)`)

      if (odds.svenska_folket_home) {
        parts.push('')
        parts.push('Svenska Folket (Public Betting):')
        parts.push(`  1: ${odds.svenska_folket_home}%`)
        parts.push(`  X: ${odds.svenska_folket_draw}%`)
        parts.push(`  2: ${odds.svenska_folket_away}%`)
      }

      if (odds.tio_tidningars_tips_home) {
        parts.push('')
        parts.push('Tio Tidningars Tips (Expert Consensus):')
        parts.push(`  1: ${odds.tio_tidningars_tips_home}/10 experts`)
        parts.push(`  X: ${odds.tio_tidningars_tips_draw}/10 experts`)
        parts.push(`  2: ${odds.tio_tidningars_tips_away}/10 experts`)
      }
      parts.push('')
    }

    // xStats
    const xStatsData = match.match_scraped_data?.find((d: any) => d.data_type === 'xStats')
    if (xStatsData?.data) {
      parts.push('EXPECTED STATISTICS (xStats)')
      parts.push('============================')
      const xStats = xStatsData.data

      if (xStats.homeTeam?.entireSeason) {
        parts.push(`${match.homeTeam.name} (Home):`)
        parts.push(`  xG: ${xStats.homeTeam.entireSeason.xg || 'N/A'}`)
        parts.push(`  xGA: ${xStats.homeTeam.entireSeason.xga || 'N/A'}`)
        parts.push(`  xGD: ${xStats.homeTeam.entireSeason.xgd || 'N/A'}`)
        parts.push(`  xP: ${xStats.homeTeam.entireSeason.xp || 'N/A'}`)
      }

      if (xStats.awayTeam?.entireSeason) {
        parts.push(`${match.awayTeam.name} (Away):`)
        parts.push(`  xG: ${xStats.awayTeam.entireSeason.xg || 'N/A'}`)
        parts.push(`  xGA: ${xStats.awayTeam.entireSeason.xga || 'N/A'}`)
        parts.push(`  xGD: ${xStats.awayTeam.entireSeason.xgd || 'N/A'}`)
        parts.push(`  xP: ${xStats.awayTeam.entireSeason.xp || 'N/A'}`)
      }

      // Extended xStats: Average goals (if available)
      if (xStats.goalStats?.home) {
        parts.push('')
        parts.push('Goal Statistics:')
        parts.push(
          `  ${match.homeTeam.name}: Avg scored ${xStats.goalStats.home.avgGoalsScored || 'N/A'}, Avg conceded ${xStats.goalStats.home.avgGoalsConceded || 'N/A'}`
        )
        parts.push(
          `  ${match.awayTeam.name}: Avg scored ${xStats.goalStats.away?.avgGoalsScored || 'N/A'}, Avg conceded ${xStats.goalStats.away?.avgGoalsConceded || 'N/A'}`
        )
      }

      // Last 5 games xStats for recent form context
      if (xStats.homeTeam?.last5Games || xStats.awayTeam?.last5Games) {
        parts.push('')
        parts.push('Recent Form (Last 5 Games):')
        if (xStats.homeTeam?.last5Games) {
          parts.push(
            `  ${match.homeTeam.name}: xG ${xStats.homeTeam.last5Games.xg || 'N/A'}, xGA ${xStats.homeTeam.last5Games.xga || 'N/A'}`
          )
        }
        if (xStats.awayTeam?.last5Games) {
          parts.push(
            `  ${match.awayTeam.name}: xG ${xStats.awayTeam.last5Games.xg || 'N/A'}, xGA ${xStats.awayTeam.last5Games.xga || 'N/A'}`
          )
        }
      }
      parts.push('')
    }

    // Lineup/Injury information
    const lineupData = match.match_scraped_data?.find((d: any) => d.data_type === 'lineup')
    if (lineupData?.data) {
      parts.push('TEAM LINEUPS & AVAILABILITY')
      parts.push('===========================')
      const lineup = lineupData.data

      if (lineup.homeTeam) {
        parts.push(`${match.homeTeam.name}:`)
        if (lineup.homeTeam.formation) {
          parts.push(`  Formation: ${lineup.homeTeam.formation}`)
        }
        parts.push(`  Lineup Status: ${lineup.homeTeam.isConfirmed ? 'Confirmed' : 'Probable'}`)
        if (lineup.homeTeam.unavailable?.length > 0) {
          parts.push(`  Unavailable Players:`)
          for (const player of lineup.homeTeam.unavailable) {
            parts.push(`    - ${player.name} (${player.reason || 'unknown reason'})`)
          }
        }
      }

      if (lineup.awayTeam) {
        parts.push(`${match.awayTeam.name}:`)
        if (lineup.awayTeam.formation) {
          parts.push(`  Formation: ${lineup.awayTeam.formation}`)
        }
        parts.push(`  Lineup Status: ${lineup.awayTeam.isConfirmed ? 'Confirmed' : 'Probable'}`)
        if (lineup.awayTeam.unavailable?.length > 0) {
          parts.push(`  Unavailable Players:`)
          for (const player of lineup.awayTeam.unavailable) {
            parts.push(`    - ${player.name} (${player.reason || 'unknown reason'})`)
          }
        }
      }
      parts.push('')
    }

    // Team statistics
    const statsData = match.match_scraped_data?.find((d: any) => d.data_type === 'statistics')
    if (statsData?.data) {
      parts.push('TEAM STATISTICS')
      parts.push('===============')
      const stats = statsData.data

      if (stats.homeTeam) {
        parts.push(`${match.homeTeam.name}:`)
        parts.push(`  Position: ${stats.homeTeam.position || 'N/A'}`)
        parts.push(`  Points: ${stats.homeTeam.points || 'N/A'}`)
        parts.push(`  Form: ${stats.homeTeam.form?.join('') || 'N/A'}`)
        parts.push(`  Played: ${stats.homeTeam.played || 'N/A'}`)
        parts.push(
          `  W-D-L: ${stats.homeTeam.won || 0}-${stats.homeTeam.drawn || 0}-${stats.homeTeam.lost || 0}`
        )
        if (stats.homeTeam.goalsFor !== undefined || stats.homeTeam.goalsAgainst !== undefined) {
          parts.push(
            `  Goals: ${stats.homeTeam.goalsFor ?? 'N/A'} scored, ${stats.homeTeam.goalsAgainst ?? 'N/A'} conceded`
          )
        }
      }

      if (stats.awayTeam) {
        parts.push(`${match.awayTeam.name}:`)
        parts.push(`  Position: ${stats.awayTeam.position || 'N/A'}`)
        parts.push(`  Points: ${stats.awayTeam.points || 'N/A'}`)
        parts.push(`  Form: ${stats.awayTeam.form?.join('') || 'N/A'}`)
        parts.push(`  Played: ${stats.awayTeam.played || 'N/A'}`)
        parts.push(
          `  W-D-L: ${stats.awayTeam.won || 0}-${stats.awayTeam.drawn || 0}-${stats.awayTeam.lost || 0}`
        )
        if (stats.awayTeam.goalsFor !== undefined || stats.awayTeam.goalsAgainst !== undefined) {
          parts.push(
            `  Goals: ${stats.awayTeam.goalsFor ?? 'N/A'} scored, ${stats.awayTeam.goalsAgainst ?? 'N/A'} conceded`
          )
        }
      }
      parts.push('')
    }

    // Head-to-head matchups
    if (teamMatchups.length > 0) {
      parts.push('HEAD-TO-HEAD HISTORY')
      parts.push('====================')
      for (const matchup of teamMatchups) {
        const result =
          matchup.result_home !== null
            ? `${matchup.result_home}-${matchup.result_away}`
            : 'Not played'
        const outcome = matchup.outcome || 'N/A'
        parts.push(
          `${matchup.draw_date?.toISOString().split('T')[0] || 'Unknown'}: ${matchup.home_team} vs ${matchup.away_team} - ${result} (${outcome})`
        )
      }
      parts.push('')
    }

    // Similar matches
    if (similarMatches.length > 0) {
      parts.push('SIMILAR HISTORICAL MATCHES')
      parts.push('=========================')
      for (const similar of similarMatches.slice(0, 5)) {
        const result =
          similar.result_home !== null
            ? `${similar.result_home}-${similar.result_away}`
            : 'Not played'
        const similarity = Math.round((similar.similarity || 0) * 100)
        parts.push(
          `[${similarity}% similar] ${similar.home_team} vs ${similar.away_team} - ${result} (${similar.outcome || 'N/A'})`
        )
      }
      parts.push('')
    }

    return parts.join('\n')
  }

  /**
   * Base system prompt for predictions - cached to reduce costs
   * Cache control enables prompt caching: first request caches, subsequent reads from cache
   */
  private static readonly BASE_PREDICTION_PROMPT = `You are an expert football analyst specializing in Swedish pool betting predictions. Your task is to analyze match data and provide accurate probability predictions.

Please provide your analysis in JSON format with the following structure:
{
  "probabilities": {
    "home_win": 0.XX (number between 0 and 1),
    "draw": 0.XX (number between 0 and 1),
    "away_win": 0.XX (number between 0 and 1)
  },
  "reasoning": "Detailed explanation of your prediction",
  "key_factors": ["Factor 1", "Factor 2", "Factor 3"],
  "recommended_bet": "1" or "X" or "2" or "1X" or "X2" or "12" or "1X2",
  "suitable_as_spik": true or false,
  "confidence": "high" or "medium" or "low"
}

Important guidelines:
- Probabilities must sum to 1.0
- Consider all available data: odds, xStats, form, head-to-head, expert consensus (Tio Tidningars Tips), and player availability
- Pay special attention to key player absences (injuries/suspensions) as they can significantly impact match outcomes
- A "spik" is suitable when one outcome has >60% probability and high confidence
- Recommended bet should maximize expected value vs crowd betting patterns
- Provide clear, actionable reasoning`

  /**
   * Game-specific system prompts
   */
  private static readonly GAME_PROMPTS: Record<string, string> = {
    stryktipset: `

Game Context: STRYKTIPSET
- Traditional Swedish 1X2 pool game with 13 matches
- Prize pool distributed: 13 rätt (~1.5M SEK), 12 rätt (~50K SEK), 11 rätt (~1.5K SEK), 10 rätt (~75 SEK)
- 65% payout rate
- Mix of Swedish Allsvenskan and international matches
- Spiks are valuable for reducing system cost while maximizing coverage`,

    europatipset: `

Game Context: EUROPATIPSET
- European football focused 1X2 pool game with 13 matches
- Same prize structure as Stryktipset: 13 rätt, 12 rätt, 11 rätt, 10 rätt
- 65% payout rate
- Primarily features top European leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1)
- Higher quality league data available, but more competitive matches
- European leagues often have clearer favorites but also more upsets`,

    topptipset: `

Game Context: TOPPTIPSET
- Compact 1X2 pool game with only 8 matches
- ALL-OR-NOTHING: Only 8 rätt wins the jackpot (no consolation prizes!)
- 70% payout rate (higher than Stryktipset/Europatipset)
- Variable stakes: 1, 2, 5, or 10 SEK per row
- Full system: 3^8 = 6,561 combinations at 1 SEK = 6,561 SEK
- Strategy: Focus on highest confidence predictions since all 8 must be correct
- Consider reduced systems that maintain 7-rätt guarantee for coverage
- Spiks are CRITICAL - incorrect spiks mean zero return
- Higher risk tolerance but potentially higher rewards
- Be more conservative with spik recommendations due to all-or-nothing nature`,
  }

  /**
   * Get the full system prompt for a specific game type
   */
  private static getSystemPrompt(gameType: string = 'stryktipset'): string {
    const gamePrompt =
      PredictionService.GAME_PROMPTS[gameType] || PredictionService.GAME_PROMPTS.stryktipset
    return PredictionService.BASE_PREDICTION_PROMPT + gamePrompt
  }

  /**
   * Legacy static prompt for backward compatibility (Stryktipset)
   */
  private static readonly PREDICTION_SYSTEM_PROMPT =
    PredictionService.getSystemPrompt('stryktipset')

  /**
   * Generate prediction using Claude
   */
  private async generatePrediction(
    context: string,
    matchId: number,
    model: PredictionModel = 'claude-sonnet-4-5',
    userId?: string,
    gameType: string = 'stryktipset'
  ): Promise<PredictionData | null> {
    const startTime = Date.now()
    try {
      const anthropic = this.getAnthropicClient()
      const systemPrompt = PredictionService.getSystemPrompt(gameType)
      const message = await anthropic.messages.create({
        model,
        max_tokens: 2000,
        // System prompt with cache_control for prompt caching
        // The system prompt is game-type-specific and will be cached for 5 minutes
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Analyze the following match and provide a detailed prediction:\n\n${context}`,
          },
        ],
      })

      const content = message.content[0]
      if (!content) {
        throw new Error('No content received from Claude')
      }

      if (content.type !== 'text') {
        throw new Error('Unexpected content type from Claude')
      }

      // Extract JSON from response
      const jsonMatch =
        content.text.match(/```json\n?([\s\S]*?)\n?```/) || content.text.match(/({[\s\S]*})/)

      if (!jsonMatch || !jsonMatch[1]) {
        throw new Error('Could not extract JSON from Claude response')
      }

      const prediction: PredictionData = JSON.parse(jsonMatch[1])

      // Validate prediction
      if (!prediction.probabilities || !prediction.reasoning || !prediction.recommended_bet) {
        throw new Error('Invalid prediction format from Claude')
      }

      // Track token usage and cost (including cache tokens)
      const inputTokens = message.usage.input_tokens
      const outputTokens = message.usage.output_tokens
      // Extract cache tokens from usage if available (prompt caching)
      const cacheCreationTokens =
        'cache_creation_input_tokens' in message.usage
          ? (message.usage.cache_creation_input_tokens as number)
          : 0
      const cacheReadTokens =
        'cache_read_input_tokens' in message.usage
          ? (message.usage.cache_read_input_tokens as number)
          : 0
      const cost = calculateAICost(
        model,
        inputTokens,
        outputTokens,
        cacheCreationTokens,
        cacheReadTokens
      )
      const duration = Date.now() - startTime

      // Record AI usage
      await recordAIUsage({
        userId,
        model,
        inputTokens,
        outputTokens,
        cost,
        dataType: 'prediction',
        operationId: `match_${matchId}`,
        endpoint: 'messages.create',
        duration,
        success: true,
      }).catch(recordError => {
        console.error('[Prediction Service] Failed to record AI usage:', recordError)
      })

      // Log cache usage if present
      const cacheInfo =
        cacheCreationTokens > 0 || cacheReadTokens > 0
          ? ` (cache: ${cacheCreationTokens} write, ${cacheReadTokens} read)`
          : ''
      console.log(
        `[Prediction Service] AI usage: ${inputTokens} in, ${outputTokens} out, $${cost.toFixed(6)}, ${duration}ms${cacheInfo}`
      )

      return prediction
    } catch (error) {
      const duration = Date.now() - startTime

      // Report to Bugsnag with AI context
      captureAIError(error, {
        model,
        operation: 'prediction',
        matchId,
        dataType: 'prediction',
      })

      // Record failed attempt
      await recordAIUsage({
        userId,
        model,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        dataType: 'prediction',
        operationId: `match_${matchId}`,
        endpoint: 'messages.create',
        duration,
        success: false,
      }).catch(recordError => {
        console.error('[Prediction Service] Failed to record AI usage error:', recordError)
      })

      console.error('[Prediction Service] Error generating prediction with Claude:', error)
      return null
    }
  }

  /**
   * Save prediction to database
   */
  private async savePrediction(
    matchId: number,
    prediction: PredictionData,
    options: { userContext?: string; isReevaluation?: boolean } = {}
  ): Promise<void> {
    const { userContext, isReevaluation = false } = options

    try {
      await prisma.predictions.create({
        data: {
          match_id: matchId,
          model: 'claude-3-5-sonnet',
          model_version: '20241022',
          probability_home: prediction.probabilities.home_win,
          probability_draw: prediction.probabilities.draw,
          probability_away: prediction.probabilities.away_win,
          predicted_outcome: this.getPredictedOutcome(prediction.probabilities),
          confidence: prediction.confidence,
          is_spik_suitable: prediction.suitable_as_spik,
          reasoning: prediction.reasoning,
          key_factors: prediction.key_factors as any,
          raw_response: prediction as any,
          user_context: userContext || null,
          is_reevaluation: isReevaluation,
        },
      })
    } catch (error) {
      console.error('[Prediction Service] Error saving prediction:', error)
      throw error
    }
  }

  /**
   * Get predicted outcome from probabilities
   */
  private getPredictedOutcome(probabilities: {
    home_win: number
    draw: number
    away_win: number
  }): string {
    const max = Math.max(probabilities.home_win, probabilities.draw, probabilities.away_win)

    if (probabilities.home_win === max) return '1'
    if (probabilities.draw === max) return 'X'
    return '2'
  }

  // ============================================================
  // BATCH PREDICTION METHODS (Anthropic Batch API - 50% discount)
  // ============================================================

  /**
   * Create a batch of predictions for multiple matches
   * Uses Anthropic Batch API for 50% cost savings
   * Results are available within 24 hours
   */
  async createPredictionBatch(
    drawNumber: number,
    matchIds: number[],
    options: { model?: PredictionModel; contexts?: Record<number, string> } = {}
  ): Promise<{ batchId: string; matchCount: number }> {
    const model = options.model || 'claude-sonnet-4-5'

    console.log(
      `[Prediction Service] Creating batch for ${matchIds.length} matches in draw ${drawNumber} using ${model}`
    )

    try {
      const anthropic = this.getAnthropicClient()

      // Prepare all match contexts
      const requests = await Promise.all(
        matchIds.map(async matchId => {
          const match = await prisma.matches.findUnique({
            where: { id: matchId },
            include: {
              draws: true,
              homeTeam: true,
              awayTeam: true,
              league: { include: { country: true } },
              match_odds: {
                where: { type: 'current' },
                orderBy: { collected_at: 'desc' },
                take: 1,
              },
              match_scraped_data: true,
            },
          })

          if (!match) {
            throw new Error(`Match ${matchId} not found`)
          }

          // Fetch statistical calculations for batch context
          const calculations = await getMatchCalculations(matchId)

          const context = this.prepareMatchContext(
            match,
            [],
            [],
            options.contexts?.[matchId],
            calculations
          )

          return {
            custom_id: `match_${matchId}`,
            params: {
              model,
              max_tokens: 2000,
              system: [
                {
                  type: 'text' as const,
                  text: PredictionService.PREDICTION_SYSTEM_PROMPT,
                },
              ],
              messages: [
                {
                  role: 'user' as const,
                  content: `Analyze the following match and provide a detailed prediction:\n\n${context}`,
                },
              ],
            },
          }
        })
      )

      // Create the batch
      const batch = await anthropic.messages.batches.create({ requests })

      // Store batch reference in database
      await prisma.prediction_batches.create({
        data: {
          batch_id: batch.id,
          draw_number: drawNumber,
          match_ids: matchIds,
          model,
          status: batch.processing_status,
        },
      })

      console.log(`[Prediction Service] Batch ${batch.id} created for ${matchIds.length} matches`)

      return { batchId: batch.id, matchCount: matchIds.length }
    } catch (error) {
      console.error('[Prediction Service] Error creating batch:', error)

      // Report batch creation error to Bugsnag
      captureAIError(error, {
        model,
        operation: 'batch_creation',
        dataType: 'prediction_batch',
      })

      throw error
    }
  }

  /**
   * Check batch status and process results if complete
   */
  async checkBatchStatus(batchId: string): Promise<{
    status: string
    requestCounts?: {
      processing: number
      succeeded: number
      errored: number
      canceled: number
      expired: number
    }
    resultsProcessed?: boolean
  }> {
    const anthropic = this.getAnthropicClient()

    try {
      const batch = await anthropic.messages.batches.retrieve(batchId)

      // Update status in database
      await prisma.prediction_batches.update({
        where: { batch_id: batchId },
        data: {
          status: batch.processing_status,
          completed_at: batch.processing_status === 'ended' ? new Date() : null,
        },
      })

      let resultsProcessed = false

      // Process results if batch is complete
      if (batch.processing_status === 'ended' && batch.results_url) {
        const dbBatch = await prisma.prediction_batches.findUnique({
          where: { batch_id: batchId },
        })

        // Only process if we haven't already
        if (dbBatch && !dbBatch.results) {
          await this.processBatchResults(batchId, batch.results_url)
          resultsProcessed = true
        }
      }

      return {
        status: batch.processing_status,
        requestCounts: batch.request_counts,
        resultsProcessed,
      }
    } catch (error) {
      console.error(`[Prediction Service] Error checking batch ${batchId}:`, error)
      throw error
    }
  }

  /**
   * Process batch results and save predictions
   */
  private async processBatchResults(batchId: string, resultsUrl: string): Promise<void> {
    console.log(`[Prediction Service] Processing results for batch ${batchId}`)

    try {
      // Fetch results from the URL
      const response = await fetch(resultsUrl)
      const text = await response.text()

      // Parse JSONL format (one JSON object per line)
      const lines = text.trim().split('\n')
      const results: any[] = []

      for (const line of lines) {
        if (line.trim()) {
          const result = JSON.parse(line)
          results.push(result)

          // Process each successful result
          if (result.result?.type === 'succeeded') {
            const matchId = parseInt(result.custom_id.replace('match_', ''))
            const message = result.result.message

            // Extract prediction from response
            const content = message.content?.[0]
            if (content?.type === 'text') {
              const jsonMatch =
                content.text.match(/```json\n?([\s\S]*?)\n?```/) ||
                content.text.match(/({[\s\S]*})/)

              if (jsonMatch?.[1]) {
                const prediction: PredictionData = JSON.parse(jsonMatch[1])

                // Save prediction
                await this.savePrediction(matchId, prediction, { isReevaluation: true })

                // Record AI usage (50% discount for batch)
                const inputTokens = message.usage?.input_tokens || 0
                const outputTokens = message.usage?.output_tokens || 0
                const cost =
                  calculateAICost(result.result.message.model, inputTokens, outputTokens) * 0.5 // 50% batch discount

                await recordAIUsage({
                  model: result.result.message.model,
                  inputTokens,
                  outputTokens,
                  cost,
                  dataType: 'prediction_batch',
                  operationId: `batch_${batchId}_match_${matchId}`,
                  endpoint: 'messages.batches',
                  duration: 0,
                  success: true,
                }).catch(err => console.error('Failed to record batch AI usage:', err))

                console.log(`[Prediction Service] Batch: Saved prediction for match ${matchId}`)
              }
            }
          } else if (result.result?.type === 'errored') {
            console.error(
              `[Prediction Service] Batch error for ${result.custom_id}:`,
              result.result.error
            )
          }
        }
      }

      // Store results in database
      await prisma.prediction_batches.update({
        where: { batch_id: batchId },
        data: { results: results as any },
      })

      console.log(`[Prediction Service] Batch ${batchId}: Processed ${results.length} results`)
    } catch (error) {
      console.error(`[Prediction Service] Error processing batch results:`, error)

      // Update batch with error
      await prisma.prediction_batches.update({
        where: { batch_id: batchId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error processing results',
        },
      })

      throw error
    }
  }

  /**
   * Get all batches for a draw
   */
  async getBatchesForDraw(drawNumber: number) {
    return prisma.prediction_batches.findMany({
      where: { draw_number: drawNumber },
      orderBy: { created_at: 'desc' },
    })
  }

  /**
   * Cancel a batch
   */
  async cancelBatch(batchId: string): Promise<void> {
    const anthropic = this.getAnthropicClient()

    try {
      await anthropic.messages.batches.cancel(batchId)

      await prisma.prediction_batches.update({
        where: { batch_id: batchId },
        data: { status: 'canceling' },
      })

      console.log(`[Prediction Service] Batch ${batchId} cancellation requested`)
    } catch (error) {
      console.error(`[Prediction Service] Error canceling batch ${batchId}:`, error)
      throw error
    }
  }
}

// Export singleton instance
export const predictionService = new PredictionService()
