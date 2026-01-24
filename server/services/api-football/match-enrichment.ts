/**
 * Match Enrichment Service
 *
 * Enriches matches with API-Football data by:
 * 1. Matching teams and leagues to API-Football IDs
 * 2. Fetching fixture ID from API-Football
 * 3. Storing mappings for future use
 * 4. Fetching and storing statistics, H2H, and injuries data (when enabled)
 *
 * This service is called after matches are synced from Svenska Spel.
 */

import type { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { getTeamMatcher } from './team-matcher'
import { getLeagueMatcher } from './league-matcher'
import { getApiFootballClient } from './client'
import type {
  ApiFootballFixtureResponse,
  ApiFootballTeamStatistics,
  ApiFootballH2HResponse,
  ApiFootballInjury,
  ApiFootballPredictionResponse,
  ApiFootballSeasonStatisticsResponse,
  ApiFootballStandingsResponse,
  ApiFootballLineup,
  ApiFootballOddsResponse,
} from './types'

// ============================================================================
// Cache TTLs
// ============================================================================

const STATISTICS_CACHE_TTL = 24 * 60 * 60 // 24 hours
const H2H_CACHE_TTL = 30 * 24 * 60 * 60 // 30 days (historical data)
const INJURIES_CACHE_TTL = 60 * 60 // 1 hour (injuries change frequently)
const PREDICTIONS_CACHE_TTL = 2 * 60 * 60 // 2 hours (predictions update 2h before kickoff)
const TEAM_STATS_CACHE_TTL = 24 * 60 * 60 // 24 hours (updates after fixtures)
const STANDINGS_CACHE_TTL = 24 * 60 * 60 // 24 hours (updates after fixtures)
const LINEUPS_CACHE_TTL = 30 * 60 // 30 minutes (can change close to kickoff)
const MARKET_ODDS_CACHE_TTL = 30 * 60 // 30 minutes (odds change more frequently)

// Cache TTLs in seconds for checking data freshness (same values but named for clarity)
const CACHE_TTL_BY_TYPE: Record<string, number> = {
  headToHead: H2H_CACHE_TTL,
  statistics: STATISTICS_CACHE_TTL,
  team_season_stats: TEAM_STATS_CACHE_TTL,
  standings: STANDINGS_CACHE_TTL,
  injuries: INJURIES_CACHE_TTL,
  api_predictions: PREDICTIONS_CACHE_TTL,
  api_lineups: LINEUPS_CACHE_TTL,
  market_odds: MARKET_ODDS_CACHE_TTL,
}

// Target bookmakers for market odds (curated list of reliable bookmakers)
const TARGET_BOOKMAKERS = [
  'Pinnacle', // Sharp bookmaker, efficient lines
  'Bet365', // High liquidity
  'Unibet', // Commonly available
  '1xBet', // Wide coverage
  'Betfair', // Exchange, reflects true market
]

// Delay between sequential API requests (in ms) to respect rate limits
const REQUEST_DELAY_MS = 500

// Quota threshold for auto-fetch (pause auto-fetch when usage exceeds this %)
const QUOTA_THRESHOLD_PERCENT = 95

// Helper: delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ============================================================================
// Types
// ============================================================================

export interface DataFreshnessResult {
  dataType: string
  exists: boolean
  isFresh: boolean
  scrapedAt: Date | null
  source: string | null
}

export interface EnsureDataResult {
  matchId: number
  hasFreshData: boolean
  missing: string[]
  stale: string[]
  details: DataFreshnessResult[]
}

export interface FetchDataResult {
  mapped: boolean
  fixtureId: number | null
  statistics: boolean
  headToHead: boolean
  injuries: boolean
  predictions: boolean
  teamStats: boolean
  standings: boolean
  lineups: boolean
  marketOdds: boolean
  error?: string
}

export interface EnrichmentResult {
  matchId: number
  success: boolean
  homeTeamMapped: boolean
  awayTeamMapped: boolean
  leagueMapped: boolean
  fixtureFound: boolean
  confidence: 'high' | 'medium' | 'low' | null
  error?: string
  // Data fetching results (when fetchDuringEnrichment is enabled)
  dataFetched?: {
    statistics: boolean
    headToHead: boolean
    injuries: boolean
    predictions: boolean
    teamStats: boolean
    standings: boolean
    lineups: boolean
  }
}

export interface BatchEnrichmentResult {
  total: number
  successful: number
  failed: number
  results: EnrichmentResult[]
}

// ============================================================================
// Match Enrichment Service
// ============================================================================

export class MatchEnrichmentService {
  private teamMatcher = getTeamMatcher()
  private leagueMatcher = getLeagueMatcher()
  private client = getApiFootballClient()

  /**
   * Enrich a single match with API-Football mappings
   */
  async enrichMatch(matchId: number): Promise<EnrichmentResult> {
    const result: EnrichmentResult = {
      matchId,
      success: false,
      homeTeamMapped: false,
      awayTeamMapped: false,
      leagueMapped: false,
      fixtureFound: false,
      confidence: null,
    }

    try {
      // Get match with related data
      const match = await prisma.matches.findUnique({
        where: { id: matchId },
        include: {
          homeTeam: true,
          awayTeam: true,
          league: {
            include: { country: true },
          },
        },
      })

      if (!match) {
        result.error = 'Match not found'
        return result
      }

      // Skip if already fully mapped
      if (
        match.api_football_fixture_id &&
        match.api_football_home_team_id &&
        match.api_football_away_team_id &&
        match.api_football_league_id
      ) {
        result.success = true
        result.homeTeamMapped = true
        result.awayTeamMapped = true
        result.leagueMapped = true
        result.fixtureFound = true
        result.confidence = (match.mapping_confidence as EnrichmentResult['confidence']) || 'high'
        return result
      }

      // Step 1: Match league
      let apiLeagueId = match.api_football_league_id
      if (!apiLeagueId) {
        const leagueMapping = await this.leagueMatcher.matchLeagueById(
          match.league_id,
          match.league.name,
          match.league.country?.name
        )

        if (leagueMapping) {
          apiLeagueId = leagueMapping.apiFootballLeagueId
          result.leagueMapped = true
        }
      } else {
        result.leagueMapped = true
      }

      // Step 2: Match home team
      let apiHomeTeamId = match.api_football_home_team_id
      let homeConfidence: 'high' | 'medium' | 'low' | null = null

      if (!apiHomeTeamId) {
        const homeMapping = await this.teamMatcher.matchTeamById(
          match.home_team_id,
          match.homeTeam.name,
          {
            leagueId: match.league_id,
            leagueName: match.league.name,
            countryName: match.league.country?.name,
            betradarId: match.betRadar_id || undefined,
          }
        )

        if (homeMapping) {
          apiHomeTeamId = homeMapping.apiFootballTeamId
          homeConfidence = homeMapping.confidence
          result.homeTeamMapped = true
        }
      } else {
        result.homeTeamMapped = true
        homeConfidence = 'high'
      }

      // Step 3: Match away team
      let apiAwayTeamId = match.api_football_away_team_id
      let awayConfidence: 'high' | 'medium' | 'low' | null = null

      if (!apiAwayTeamId) {
        const awayMapping = await this.teamMatcher.matchTeamById(
          match.away_team_id,
          match.awayTeam.name,
          {
            leagueId: match.league_id,
            leagueName: match.league.name,
            countryName: match.league.country?.name,
            kambiId: match.kambi_id || undefined,
          }
        )

        if (awayMapping) {
          apiAwayTeamId = awayMapping.apiFootballTeamId
          awayConfidence = awayMapping.confidence
          result.awayTeamMapped = true
        }
      } else {
        result.awayTeamMapped = true
        awayConfidence = 'high'
      }

      // Step 4: Find fixture ID (if teams are mapped)
      let apiFixtureId = match.api_football_fixture_id

      if (!apiFixtureId && apiHomeTeamId && apiAwayTeamId) {
        apiFixtureId = await this.findFixtureId(
          match.start_time,
          apiHomeTeamId,
          apiAwayTeamId,
          apiLeagueId || undefined
        )

        if (apiFixtureId) {
          result.fixtureFound = true
        }
      } else if (apiFixtureId) {
        result.fixtureFound = true
      }

      // Calculate overall confidence
      if (homeConfidence && awayConfidence) {
        if (homeConfidence === 'low' || awayConfidence === 'low') {
          result.confidence = 'low'
        } else if (homeConfidence === 'medium' || awayConfidence === 'medium') {
          result.confidence = 'medium'
        } else {
          result.confidence = 'high'
        }
      }

      // Update match with API-Football IDs
      await prisma.matches.update({
        where: { id: matchId },
        data: {
          api_football_fixture_id: apiFixtureId,
          api_football_league_id: apiLeagueId,
          api_football_home_team_id: apiHomeTeamId,
          api_football_away_team_id: apiAwayTeamId,
          mapping_confidence: result.confidence,
        },
      })

      result.success = true
      console.log(
        `[MatchEnrichment] Enriched match ${matchId}: fixture=${apiFixtureId}, home=${apiHomeTeamId}, away=${apiAwayTeamId}, confidence=${result.confidence}`
      )

      // Step 5: Fetch and store API-Football data (if enabled)
      const runtimeConfig = useRuntimeConfig()
      const apiFootballConfig = runtimeConfig.apiFootball as {
        enabled?: boolean
        fetchDuringEnrichment?: boolean
        dataTypes?: string[]
        enablePredictions?: boolean
        enableTeamStats?: boolean
        enableStandings?: boolean
        enableLineups?: boolean
      }

      if (
        apiFootballConfig?.enabled &&
        apiFootballConfig?.fetchDuringEnrichment &&
        apiHomeTeamId &&
        apiAwayTeamId
      ) {
        const dataTypes = apiFootballConfig.dataTypes || ['statistics', 'headToHead', 'injuries']
        result.dataFetched = {
          statistics: false,
          headToHead: false,
          injuries: false,
          predictions: false,
          teamStats: false,
          standings: false,
          lineups: false,
        }

        // Fetch statistics (requires fixture ID)
        if (dataTypes.includes('statistics') && apiFixtureId) {
          try {
            const fetched = await this.fetchAndStoreStatistics(matchId, apiFixtureId)
            result.dataFetched.statistics = fetched
          } catch (error) {
            console.warn(`[MatchEnrichment] Error fetching statistics for match ${matchId}:`, error)
          }
        }

        // Fetch H2H
        if (dataTypes.includes('headToHead')) {
          try {
            const fetched = await this.fetchAndStoreH2H(matchId, apiHomeTeamId, apiAwayTeamId)
            result.dataFetched.headToHead = fetched
          } catch (error) {
            console.warn(`[MatchEnrichment] Error fetching H2H for match ${matchId}:`, error)
          }
        }

        // Fetch injuries
        if (dataTypes.includes('injuries')) {
          try {
            const injuriesSeason = new Date(match.start_time).getFullYear()
            const fetched = await this.fetchAndStoreInjuries(
              matchId,
              apiHomeTeamId,
              apiAwayTeamId,
              apiFixtureId || undefined,
              injuriesSeason
            )
            result.dataFetched.injuries = fetched
          } catch (error) {
            console.warn(`[MatchEnrichment] Error fetching injuries for match ${matchId}:`, error)
          }
        }

        // Fetch API-Football predictions (requires fixture ID)
        if (
          (dataTypes.includes('predictions') || apiFootballConfig.enablePredictions !== false) &&
          apiFixtureId
        ) {
          try {
            const fetched = await this.fetchAndStorePredictions(matchId, apiFixtureId)
            result.dataFetched.predictions = fetched
          } catch (error) {
            console.warn(
              `[MatchEnrichment] Error fetching predictions for match ${matchId}:`,
              error
            )
          }
        }

        // Fetch team season statistics (requires league ID)
        if (
          (dataTypes.includes('teamStats') || apiFootballConfig.enableTeamStats !== false) &&
          apiLeagueId
        ) {
          try {
            const season = new Date(match.start_time).getFullYear()
            const fetched = await this.fetchAndStoreTeamSeasonStats(
              matchId,
              apiHomeTeamId,
              apiAwayTeamId,
              apiLeagueId,
              season
            )
            result.dataFetched.teamStats = fetched
          } catch (error) {
            console.warn(`[MatchEnrichment] Error fetching team stats for match ${matchId}:`, error)
          }
        }

        // Fetch standings (requires league ID)
        if (
          (dataTypes.includes('standings') || apiFootballConfig.enableStandings !== false) &&
          apiLeagueId
        ) {
          try {
            const season = new Date(match.start_time).getFullYear()
            const fetched = await this.fetchAndStoreStandings(matchId, apiLeagueId, season)
            result.dataFetched.standings = fetched
          } catch (error) {
            console.warn(`[MatchEnrichment] Error fetching standings for match ${matchId}:`, error)
          }
        }

        // Fetch lineups (only if explicitly enabled - typically fetched closer to match time)
        if (dataTypes.includes('lineups') && apiFootballConfig.enableLineups && apiFixtureId) {
          try {
            const fetched = await this.fetchAndStoreLineups(matchId, apiFixtureId)
            result.dataFetched.lineups = fetched
          } catch (error) {
            console.warn(`[MatchEnrichment] Error fetching lineups for match ${matchId}:`, error)
          }
        }

        console.log(
          `[MatchEnrichment] Data fetched for match ${matchId}: stats=${result.dataFetched.statistics}, h2h=${result.dataFetched.headToHead}, injuries=${result.dataFetched.injuries}, predictions=${result.dataFetched.predictions}, teamStats=${result.dataFetched.teamStats}, standings=${result.dataFetched.standings}`
        )
      }

      // Auto-fetch data in background if enabled and mapping was successful
      // This is separate from fetchDuringEnrichment - it runs async/non-blocking
      const enableAutoFetch = process.env.ENABLE_AUTO_FETCH !== 'false'
      if (enableAutoFetch && apiHomeTeamId && apiAwayTeamId) {
        // Run in background (non-blocking) - don't await
        this.fetchDataAfterEnrichment(matchId).catch(err => {
          console.warn(`[MatchEnrichment] Background auto-fetch failed for match ${matchId}:`, err)
        })
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[MatchEnrichment] Error enriching match ${matchId}:`, error)
    }

    return result
  }

  /**
   * Enrich all matches in a draw
   */
  async enrichDraw(drawId: number): Promise<BatchEnrichmentResult> {
    const matches = await prisma.matches.findMany({
      where: { draw_id: drawId },
      select: { id: true },
    })

    const results: EnrichmentResult[] = []
    let successful = 0
    let failed = 0

    for (const match of matches) {
      const result = await this.enrichMatch(match.id)
      results.push(result)

      if (result.success) {
        successful++
      } else {
        failed++
      }
    }

    console.log(
      `[MatchEnrichment] Enriched draw ${drawId}: ${successful}/${matches.length} successful`
    )

    return {
      total: matches.length,
      successful,
      failed,
      results,
    }
  }

  /**
   * Enrich all unmapped matches (batch processing)
   */
  async enrichUnmappedMatches(limit = 50): Promise<BatchEnrichmentResult> {
    const matches = await prisma.matches.findMany({
      where: {
        OR: [
          { api_football_fixture_id: null },
          { api_football_home_team_id: null },
          { api_football_away_team_id: null },
        ],
      },
      select: { id: true },
      take: limit,
      orderBy: { created_at: 'desc' },
    })

    const results: EnrichmentResult[] = []
    let successful = 0
    let failed = 0

    for (const match of matches) {
      const result = await this.enrichMatch(match.id)
      results.push(result)

      if (result.success) {
        successful++
      } else {
        failed++
      }
    }

    return {
      total: matches.length,
      successful,
      failed,
      results,
    }
  }

  /**
   * Find API-Football fixture ID by date and teams
   */
  private async findFixtureId(
    matchDate: Date,
    homeTeamId: number,
    awayTeamId: number,
    leagueId?: number
  ): Promise<number | null> {
    if (!this.client.isConfigured() || this.client.isCircuitOpen()) {
      return null
    }

    const dateStr = matchDate.toISOString().split('T')[0]!

    try {
      // Build params
      const params: Record<string, string | number> = {
        date: dateStr,
        team: homeTeamId,
      }

      if (leagueId) {
        params.league = leagueId
      }

      const response = await this.client.get<ApiFootballFixtureResponse[]>('/fixtures', params, {
        cacheTtlSeconds: 30 * 24 * 60 * 60, // Cache for 30 days
      })

      if (
        !response.response ||
        !Array.isArray(response.response) ||
        response.response.length === 0
      ) {
        return null
      }

      // Find matching fixture
      const fixture = response.response.find(
        f => f.teams.home.id === homeTeamId && f.teams.away.id === awayTeamId
      )

      return fixture?.fixture?.id || null
    } catch (error) {
      console.warn(`[MatchEnrichment] Error finding fixture:`, error)
      return null
    }
  }

  // ==========================================================================
  // Data Fetching Methods
  // ==========================================================================

  /**
   * Fetch and store fixture statistics from API-Football
   */
  private async fetchAndStoreStatistics(matchId: number, fixtureId: number): Promise<boolean> {
    if (!this.client.isConfigured() || this.client.isCircuitOpen()) {
      return false
    }

    try {
      const response = await this.client.get<ApiFootballTeamStatistics[]>(
        '/fixtures/statistics',
        { fixture: fixtureId },
        { cacheTtlSeconds: STATISTICS_CACHE_TTL }
      )

      if (!response.response || response.response.length === 0) {
        return false
      }

      // Normalize and store the statistics
      const normalizedData = {
        fixtureId,
        teams: response.response.map(teamStats => ({
          teamId: teamStats.team.id,
          teamName: teamStats.team.name,
          statistics: this.normalizeStatistics(teamStats.statistics),
        })),
        fetchedAt: new Date().toISOString(),
      }

      await this.storeMatchData(matchId, 'statistics', normalizedData)
      return true
    } catch (error) {
      console.warn(`[MatchEnrichment] Error fetching statistics:`, error)
      return false
    }
  }

  /**
   * Fetch and store head-to-head data from API-Football
   */
  private async fetchAndStoreH2H(
    matchId: number,
    homeTeamId: number,
    awayTeamId: number
  ): Promise<boolean> {
    if (!this.client.isConfigured() || this.client.isCircuitOpen()) {
      return false
    }

    try {
      const response = await this.client.get<ApiFootballH2HResponse[]>(
        '/fixtures/headtohead',
        { h2h: `${homeTeamId}-${awayTeamId}` },
        { cacheTtlSeconds: H2H_CACHE_TTL }
      )

      if (!response.response || response.response.length === 0) {
        return false
      }

      // Calculate H2H summary
      let homeWins = 0
      let awayWins = 0
      let draws = 0

      const lastMatches = response.response.slice(0, 10).map(fixture => {
        const homeGoals = fixture.goals.home || 0
        const awayGoals = fixture.goals.away || 0

        // Determine winner (relative to the teams in our fixture)
        if (fixture.teams.home.id === homeTeamId) {
          if (homeGoals > awayGoals) homeWins++
          else if (awayGoals > homeGoals) awayWins++
          else draws++
        } else {
          if (homeGoals > awayGoals) awayWins++
          else if (awayGoals > homeGoals) homeWins++
          else draws++
        }

        return {
          date: fixture.fixture.date,
          homeTeamId: fixture.teams.home.id,
          homeTeamName: fixture.teams.home.name,
          awayTeamId: fixture.teams.away.id,
          awayTeamName: fixture.teams.away.name,
          homeGoals,
          awayGoals,
          venue: fixture.fixture.venue?.name,
          league: fixture.league?.name,
        }
      })

      const normalizedData = {
        homeTeamId,
        awayTeamId,
        totalMatches: response.response.length,
        homeWins,
        awayWins,
        draws,
        lastMatches,
        fetchedAt: new Date().toISOString(),
      }

      await this.storeMatchData(matchId, 'headToHead', normalizedData)
      return true
    } catch (error) {
      console.warn(`[MatchEnrichment] Error fetching H2H:`, error)
      return false
    }
  }

  /**
   * Fetch and store injuries data from API-Football
   */
  private async fetchAndStoreInjuries(
    matchId: number,
    homeTeamId: number,
    awayTeamId: number,
    fixtureId?: number,
    season?: number
  ): Promise<boolean> {
    if (!this.client.isConfigured() || this.client.isCircuitOpen()) {
      return false
    }

    try {
      // Fetch injuries for both teams
      // When using team parameter (no fixture ID), season is required by API-Football
      const [homeInjuries, awayInjuries] = await Promise.all([
        this.client.get<ApiFootballInjury[]>(
          '/injuries',
          fixtureId ? { fixture: fixtureId } : { team: homeTeamId, season: season! },
          { cacheTtlSeconds: INJURIES_CACHE_TTL }
        ),
        fixtureId
          ? Promise.resolve({ response: [] as ApiFootballInjury[] }) // Fixture-based query returns both teams
          : this.client.get<ApiFootballInjury[]>(
              '/injuries',
              { team: awayTeamId, season: season! },
              { cacheTtlSeconds: INJURIES_CACHE_TTL }
            ),
      ])

      const allInjuries = [...(homeInjuries.response || []), ...(awayInjuries.response || [])]

      if (allInjuries.length === 0) {
        // Store empty injuries to indicate we checked
        await this.storeMatchData(matchId, 'injuries', {
          homeTeamId,
          awayTeamId,
          injuries: [],
          fetchedAt: new Date().toISOString(),
        })
        return true
      }

      // Normalize injuries
      // API-Football docs: player.type = injury category, player.reason = detailed description
      const normalizedInjuries = allInjuries.map(injury => ({
        playerId: injury.player.id,
        playerName: injury.player.name,
        teamId: injury.team.id,
        teamName: injury.team.name,
        type: injury.player.type, // Injury category: 'Muscle Injury', 'Knee Injury', 'Suspended', etc.
        reason: injury.player.reason, // Detailed description: 'Hamstring', 'ACL', 'Red Card', etc.
        severity: this.parseSeverity(injury.player.type, injury.player.reason),
      }))

      const normalizedData = {
        homeTeamId,
        awayTeamId,
        injuries: normalizedInjuries,
        fetchedAt: new Date().toISOString(),
      }

      await this.storeMatchData(matchId, 'injuries', normalizedData)
      return true
    } catch (error) {
      console.warn(`[MatchEnrichment] Error fetching injuries:`, error)
      return false
    }
  }

  /**
   * Fetch and store API-Football predictions
   * Endpoint: GET /predictions?fixture={fixtureId}
   */
  private async fetchAndStorePredictions(matchId: number, fixtureId: number): Promise<boolean> {
    if (!this.client.isConfigured() || this.client.isCircuitOpen()) {
      return false
    }

    try {
      const response = await this.client.get<ApiFootballPredictionResponse[]>(
        '/predictions',
        { fixture: fixtureId },
        { cacheTtlSeconds: PREDICTIONS_CACHE_TTL }
      )

      if (!response.response || response.response.length === 0) {
        return false
      }

      const prediction = response.response[0]!

      // Normalize and store the prediction data
      const normalizedData = {
        fixtureId,
        predictions: {
          winner: prediction.predictions.winner,
          winOrDraw: prediction.predictions.win_or_draw,
          underOver: prediction.predictions.under_over,
          goals: prediction.predictions.goals,
          advice: prediction.predictions.advice,
          percent: {
            home: prediction.predictions.percent.home,
            draw: prediction.predictions.percent.draw,
            away: prediction.predictions.percent.away,
          },
        },
        comparison: {
          form: prediction.comparison.form,
          attack: prediction.comparison.att,
          defense: prediction.comparison.def,
          poissonDistribution: prediction.comparison.poisson_distribution,
          h2h: prediction.comparison.h2h,
          goals: prediction.comparison.goals,
          total: prediction.comparison.total,
        },
        teams: {
          home: {
            id: prediction.teams.home.id,
            name: prediction.teams.home.name,
            last5Form: prediction.teams.home.last_5?.form,
            last5GoalsFor: prediction.teams.home.last_5?.goals?.for?.total,
            last5GoalsAgainst: prediction.teams.home.last_5?.goals?.against?.total,
          },
          away: {
            id: prediction.teams.away.id,
            name: prediction.teams.away.name,
            last5Form: prediction.teams.away.last_5?.form,
            last5GoalsFor: prediction.teams.away.last_5?.goals?.for?.total,
            last5GoalsAgainst: prediction.teams.away.last_5?.goals?.against?.total,
          },
        },
        fetchedAt: new Date().toISOString(),
      }

      await this.storeMatchData(matchId, 'api_predictions', normalizedData)
      return true
    } catch (error) {
      console.warn(`[MatchEnrichment] Error fetching predictions:`, error)
      return false
    }
  }

  /**
   * Fetch and store team season statistics for both teams
   * Endpoint: GET /teams/statistics?league={leagueId}&season={season}&team={teamId}
   */
  private async fetchAndStoreTeamSeasonStats(
    matchId: number,
    homeTeamId: number,
    awayTeamId: number,
    leagueId: number,
    season: number
  ): Promise<boolean> {
    if (!this.client.isConfigured() || this.client.isCircuitOpen()) {
      return false
    }

    try {
      // Fetch statistics for both teams
      const [homeStatsResponse, awayStatsResponse] = await Promise.all([
        this.client.get<ApiFootballSeasonStatisticsResponse>(
          '/teams/statistics',
          { league: leagueId, season, team: homeTeamId },
          { cacheTtlSeconds: TEAM_STATS_CACHE_TTL }
        ),
        this.client.get<ApiFootballSeasonStatisticsResponse>(
          '/teams/statistics',
          { league: leagueId, season, team: awayTeamId },
          { cacheTtlSeconds: TEAM_STATS_CACHE_TTL }
        ),
      ])

      const homeStats = homeStatsResponse.response
      const awayStats = awayStatsResponse.response

      if (!homeStats && !awayStats) {
        return false
      }

      // Normalize and store the team statistics
      const normalizedData = {
        leagueId,
        season,
        homeTeam: homeStats
          ? {
              id: homeStats.team.id,
              name: homeStats.team.name,
              form: homeStats.form,
              fixtures: homeStats.fixtures,
              goals: homeStats.goals,
              biggest: homeStats.biggest,
              cleanSheet: homeStats.clean_sheet,
              failedToScore: homeStats.failed_to_score,
              penalty: homeStats.penalty,
            }
          : null,
        awayTeam: awayStats
          ? {
              id: awayStats.team.id,
              name: awayStats.team.name,
              form: awayStats.form,
              fixtures: awayStats.fixtures,
              goals: awayStats.goals,
              biggest: awayStats.biggest,
              cleanSheet: awayStats.clean_sheet,
              failedToScore: awayStats.failed_to_score,
              penalty: awayStats.penalty,
            }
          : null,
        fetchedAt: new Date().toISOString(),
      }

      await this.storeMatchData(matchId, 'team_season_stats', normalizedData)
      return true
    } catch (error) {
      console.warn(`[MatchEnrichment] Error fetching team season stats:`, error)
      return false
    }
  }

  /**
   * Fetch and store league standings
   * Endpoint: GET /standings?league={leagueId}&season={season}
   */
  private async fetchAndStoreStandings(
    matchId: number,
    leagueId: number,
    season: number
  ): Promise<boolean> {
    if (!this.client.isConfigured() || this.client.isCircuitOpen()) {
      return false
    }

    try {
      const response = await this.client.get<ApiFootballStandingsResponse[]>(
        '/standings',
        { league: leagueId, season },
        { cacheTtlSeconds: STANDINGS_CACHE_TTL }
      )

      if (!response.response || response.response.length === 0) {
        return false
      }

      const standingsData = response.response[0]!

      // Flatten the standings array (handles groups/stages)
      const allStandings = standingsData.league.standings.flat()

      // Normalize standings entries
      const normalizedStandings = allStandings.map(entry => ({
        rank: entry.rank,
        teamId: entry.team.id,
        teamName: entry.team.name,
        teamLogo: entry.team.logo,
        points: entry.points,
        goalsDiff: entry.goalsDiff,
        group: entry.group,
        form: entry.form,
        status: entry.status,
        description: entry.description,
        all: entry.all,
        home: entry.home,
        away: entry.away,
      }))

      const normalizedData = {
        leagueId,
        leagueName: standingsData.league.name,
        season,
        country: standingsData.league.country,
        standings: normalizedStandings,
        fetchedAt: new Date().toISOString(),
      }

      await this.storeMatchData(matchId, 'standings', normalizedData)
      return true
    } catch (error) {
      console.warn(`[MatchEnrichment] Error fetching standings:`, error)
      return false
    }
  }

  /**
   * Fetch and store confirmed lineups
   * Endpoint: GET /fixtures/lineups?fixture={fixtureId}
   * Note: Lineups are typically available 1 hour before kickoff
   */
  private async fetchAndStoreLineups(matchId: number, fixtureId: number): Promise<boolean> {
    if (!this.client.isConfigured() || this.client.isCircuitOpen()) {
      return false
    }

    try {
      const response = await this.client.get<ApiFootballLineup[]>(
        '/fixtures/lineups',
        { fixture: fixtureId },
        { cacheTtlSeconds: LINEUPS_CACHE_TTL }
      )

      if (!response.response || response.response.length === 0) {
        return false
      }

      // Normalize lineup data for both teams
      const normalizedLineups = response.response.map(lineup => ({
        teamId: lineup.team.id,
        teamName: lineup.team.name,
        formation: lineup.formation,
        coach: lineup.coach
          ? {
              id: lineup.coach.id,
              name: lineup.coach.name,
            }
          : null,
        startXI: lineup.startXI.map(p => ({
          id: p.player.id,
          name: p.player.name,
          number: p.player.number,
          position: p.player.pos,
          grid: p.player.grid,
        })),
        substitutes: lineup.substitutes.map(p => ({
          id: p.player.id,
          name: p.player.name,
          number: p.player.number,
          position: p.player.pos,
        })),
      }))

      const normalizedData = {
        fixtureId,
        lineups: normalizedLineups,
        isConfirmed: true,
        fetchedAt: new Date().toISOString(),
      }

      await this.storeMatchData(matchId, 'api_lineups', normalizedData)
      return true
    } catch (error) {
      console.warn(`[MatchEnrichment] Error fetching lineups:`, error)
      return false
    }
  }

  /**
   * Fetch and store market odds from multiple bookmakers
   * Endpoint: GET /odds?fixture={fixtureId}&bet=1 (Match Winner only)
   * Also calculates and stores market consensus
   */
  private async fetchAndStoreMarketOdds(matchId: number, fixtureId: number): Promise<boolean> {
    // Check if market odds fetching is enabled
    const enableMarketOdds = process.env.API_FOOTBALL_ENABLE_MARKET_ODDS !== 'false'
    if (!enableMarketOdds) {
      console.log(`[MatchEnrichment] Market odds fetching disabled via environment variable`)
      return false
    }

    if (!this.client.isConfigured() || this.client.isCircuitOpen()) {
      return false
    }

    try {
      const response = await this.client.get<ApiFootballOddsResponse[]>(
        '/odds',
        { fixture: fixtureId, bet: 1 }, // bet=1 is "Match Winner" (1X2)
        { cacheTtlSeconds: MARKET_ODDS_CACHE_TTL }
      )

      if (!response.response || response.response.length === 0) {
        console.warn(`[MatchEnrichment] No odds available for fixture ${fixtureId}`)
        return false
      }

      const oddsData = response.response[0]!
      if (!oddsData.bookmakers || oddsData.bookmakers.length === 0) {
        console.warn(`[MatchEnrichment] No bookmakers found for fixture ${fixtureId}`)
        return false
      }

      // Filter to target bookmakers
      const targetBookmakers = oddsData.bookmakers.filter(bm =>
        TARGET_BOOKMAKERS.some(target => bm.name.toLowerCase().includes(target.toLowerCase()))
      )

      if (targetBookmakers.length === 0) {
        console.warn(`[MatchEnrichment] None of target bookmakers found for fixture ${fixtureId}`)
        // Fall back to any available bookmakers (up to 5)
        targetBookmakers.push(...oddsData.bookmakers.slice(0, 5))
      }

      const now = new Date()
      const storedBookmakers: string[] = []
      const allImpliedProbabilities: { home: number; draw: number; away: number }[] = []

      // Store each bookmaker's odds
      for (const bookmaker of targetBookmakers) {
        const matchWinnerBet = bookmaker.bets.find(
          bet => bet.id === 1 || bet.name === 'Match Winner'
        )
        if (!matchWinnerBet) continue

        const homeValue = matchWinnerBet.values.find(v => v.value === 'Home')
        const drawValue = matchWinnerBet.values.find(v => v.value === 'Draw')
        const awayValue = matchWinnerBet.values.find(v => v.value === 'Away')

        if (!homeValue || !drawValue || !awayValue) continue

        const homeOdds = parseFloat(homeValue.odd)
        const drawOdds = parseFloat(drawValue.odd)
        const awayOdds = parseFloat(awayValue.odd)

        if (isNaN(homeOdds) || isNaN(drawOdds) || isNaN(awayOdds)) continue

        // Calculate implied probabilities (before margin removal)
        const impliedHome = (1 / homeOdds) * 100
        const impliedDraw = (1 / drawOdds) * 100
        const impliedAway = (1 / awayOdds) * 100

        allImpliedProbabilities.push({ home: impliedHome, draw: impliedDraw, away: impliedAway })

        // Store bookmaker odds in match_odds table
        const bookmakerSource = bookmaker.name.toLowerCase().replace(/\s+/g, '_')
        await prisma.match_odds.upsert({
          where: {
            match_id_source_type_collected_at: {
              match_id: matchId,
              source: bookmakerSource,
              type: 'market',
              collected_at: now,
            },
          },
          create: {
            match_id: matchId,
            source: bookmakerSource,
            type: 'market',
            home_odds: homeOdds,
            draw_odds: drawOdds,
            away_odds: awayOdds,
            home_probability: impliedHome,
            draw_probability: impliedDraw,
            away_probability: impliedAway,
            collected_at: now,
          },
          update: {
            home_odds: homeOdds,
            draw_odds: drawOdds,
            away_odds: awayOdds,
            home_probability: impliedHome,
            draw_probability: impliedDraw,
            away_probability: impliedAway,
          },
        })

        storedBookmakers.push(bookmaker.name)
      }

      // Calculate and store market consensus
      if (allImpliedProbabilities.length > 0) {
        const consensusResult = this.calculateMarketConsensus(allImpliedProbabilities)

        // Store market consensus as a special source
        await prisma.match_odds.upsert({
          where: {
            match_id_source_type_collected_at: {
              match_id: matchId,
              source: 'market_consensus',
              type: 'market',
              collected_at: now,
            },
          },
          create: {
            match_id: matchId,
            source: 'market_consensus',
            type: 'market',
            home_odds: consensusResult.fairOdds.home,
            draw_odds: consensusResult.fairOdds.draw,
            away_odds: consensusResult.fairOdds.away,
            home_probability: consensusResult.fairProbabilities.home,
            draw_probability: consensusResult.fairProbabilities.draw,
            away_probability: consensusResult.fairProbabilities.away,
            collected_at: now,
          },
          update: {
            home_odds: consensusResult.fairOdds.home,
            draw_odds: consensusResult.fairOdds.draw,
            away_odds: consensusResult.fairOdds.away,
            home_probability: consensusResult.fairProbabilities.home,
            draw_probability: consensusResult.fairProbabilities.draw,
            away_probability: consensusResult.fairProbabilities.away,
          },
        })

        // Also store as scraped data for additional metrics
        await this.storeMatchData(matchId, 'market_odds', {
          fixtureId,
          bookmakers: storedBookmakers,
          consensus: consensusResult,
          bookmakerCount: allImpliedProbabilities.length,
          fetchedAt: now.toISOString(),
        })
      }

      console.log(
        `[MatchEnrichment] Stored market odds from ${storedBookmakers.length} bookmakers for match ${matchId}: ${storedBookmakers.join(', ')}`
      )

      return storedBookmakers.length > 0
    } catch (error) {
      console.warn(`[MatchEnrichment] Error fetching market odds:`, error)
      return false
    }
  }

  /**
   * Calculate market consensus from multiple bookmaker probabilities.
   * Uses equal-margin method to remove bookmaker margin and get fair probabilities.
   */
  private calculateMarketConsensus(probabilities: { home: number; draw: number; away: number }[]): {
    fairProbabilities: { home: number; draw: number; away: number }
    fairOdds: { home: number; draw: number; away: number }
    averageMargin: number
    standardDeviation: { home: number; draw: number; away: number }
  } {
    const n = probabilities.length

    // Calculate average implied probabilities
    const avgHome = probabilities.reduce((sum, p) => sum + p.home, 0) / n
    const avgDraw = probabilities.reduce((sum, p) => sum + p.draw, 0) / n
    const avgAway = probabilities.reduce((sum, p) => sum + p.away, 0) / n

    // Calculate total (includes margin) - typically >100%
    const totalImplied = avgHome + avgDraw + avgAway
    const averageMargin = totalImplied - 100

    // Remove margin using equal-margin method (divide by total and multiply by 100)
    const fairHome = (avgHome / totalImplied) * 100
    const fairDraw = (avgDraw / totalImplied) * 100
    const fairAway = (avgAway / totalImplied) * 100

    // Calculate fair odds from fair probabilities
    const fairOddsHome = fairHome > 0 ? 100 / fairHome : 0
    const fairOddsDraw = fairDraw > 0 ? 100 / fairDraw : 0
    const fairOddsAway = fairAway > 0 ? 100 / fairAway : 0

    // Calculate standard deviation (measure of market disagreement)
    const stdHome = Math.sqrt(
      probabilities.reduce((sum, p) => sum + Math.pow(p.home - avgHome, 2), 0) / n
    )
    const stdDraw = Math.sqrt(
      probabilities.reduce((sum, p) => sum + Math.pow(p.draw - avgDraw, 2), 0) / n
    )
    const stdAway = Math.sqrt(
      probabilities.reduce((sum, p) => sum + Math.pow(p.away - avgAway, 2), 0) / n
    )

    return {
      fairProbabilities: {
        home: Math.round(fairHome * 100) / 100,
        draw: Math.round(fairDraw * 100) / 100,
        away: Math.round(fairAway * 100) / 100,
      },
      fairOdds: {
        home: Math.round(fairOddsHome * 100) / 100,
        draw: Math.round(fairOddsDraw * 100) / 100,
        away: Math.round(fairOddsAway * 100) / 100,
      },
      averageMargin: Math.round(averageMargin * 100) / 100,
      standardDeviation: {
        home: Math.round(stdHome * 100) / 100,
        draw: Math.round(stdDraw * 100) / 100,
        away: Math.round(stdAway * 100) / 100,
      },
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Normalize API-Football statistics to a consistent format
   */
  private normalizeStatistics(
    stats: Array<{ type: string; value: number | string | null }>
  ): Record<string, number | string | null> {
    const normalized: Record<string, number | string | null> = {}
    for (const stat of stats) {
      // Convert type to camelCase key
      const key = stat.type
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
      normalized[key] = stat.value
    }
    return normalized
  }

  /**
   * Parse injury severity from injury type string
   * Based on API-Football documentation:
   * - player.type contains injury category (e.g., "Muscle Injury", "Knee Injury", "Suspended")
   * - player.reason contains detailed description (e.g., "Hamstring", "ACL", "Red Card")
   */
  private parseSeverity(injuryType: string, reason?: string): 'minor' | 'moderate' | 'severe' {
    const typeLower = injuryType.toLowerCase()
    const reasonLower = (reason || '').toLowerCase()

    // Severe injuries - long-term or confirmed out
    if (
      typeLower.includes('knee') ||
      typeLower.includes('acl') ||
      typeLower.includes('mcl') ||
      typeLower.includes('ankle') ||
      typeLower.includes('achilles') ||
      typeLower.includes('back') ||
      reasonLower.includes('surgery') ||
      reasonLower.includes('fracture') ||
      reasonLower.includes('ligament')
    ) {
      return 'severe'
    }

    // Suspended players are always out
    if (typeLower.includes('suspended') || typeLower.includes('red card')) {
      return 'severe'
    }

    // Minor injuries - questionable or short-term
    if (
      typeLower.includes('minor') ||
      typeLower.includes('knock') ||
      typeLower.includes('bruise') ||
      typeLower.includes('illness') ||
      reasonLower.includes('rest') ||
      reasonLower.includes('precaution')
    ) {
      return 'minor'
    }

    // Muscle injuries vary - default to moderate
    if (
      typeLower.includes('muscle') ||
      typeLower.includes('hamstring') ||
      typeLower.includes('calf')
    ) {
      return 'moderate'
    }

    // Default to moderate for unknown injury types
    return 'moderate'
  }

  /**
   * Store data in match_scraped_data table
   */
  private async storeMatchData(matchId: number, dataType: string, data: unknown): Promise<void> {
    const jsonData = data as Prisma.InputJsonValue
    await prisma.match_scraped_data.upsert({
      where: {
        match_id_data_type: {
          match_id: matchId,
          data_type: dataType,
        },
      },
      create: {
        match_id: matchId,
        data_type: dataType,
        data: jsonData,
        source: 'api-football',
        is_stale: false,
      },
      update: {
        data: jsonData,
        source: 'api-football',
        is_stale: false,
        scraped_at: new Date(),
      },
    })
  }

  /**
   * Get enrichment statistics
   */
  async getEnrichmentStats(): Promise<{
    totalMatches: number
    fullyMapped: number
    partiallyMapped: number
    unmapped: number
    byConfidence: { high: number; medium: number; low: number }
  }> {
    const [total, fullyMapped, partiallyMapped, byConfidence] = await Promise.all([
      prisma.matches.count(),
      prisma.matches.count({
        where: {
          api_football_fixture_id: { not: null },
          api_football_home_team_id: { not: null },
          api_football_away_team_id: { not: null },
        },
      }),
      prisma.matches.count({
        where: {
          OR: [
            { api_football_home_team_id: { not: null } },
            { api_football_away_team_id: { not: null } },
          ],
          api_football_fixture_id: null,
        },
      }),
      prisma.matches.groupBy({
        by: ['mapping_confidence'],
        _count: true,
        where: { mapping_confidence: { not: null } },
      }),
    ])

    const confidenceCounts = { high: 0, medium: 0, low: 0 }
    for (const c of byConfidence) {
      if (c.mapping_confidence === 'high') confidenceCounts.high = c._count
      else if (c.mapping_confidence === 'medium') confidenceCounts.medium = c._count
      else if (c.mapping_confidence === 'low') confidenceCounts.low = c._count
    }

    return {
      totalMatches: total,
      fullyMapped,
      partiallyMapped,
      unmapped: total - fullyMapped - partiallyMapped,
      byConfidence: confidenceCounts,
    }
  }

  /**
   * Fetch all available API-Football data for a match on-demand.
   * This is called when the user clicks "Fetch Data" button.
   * It ensures the match is mapped first, then fetches all data types.
   */
  async fetchAllDataForMatch(matchId: number): Promise<FetchDataResult> {
    const result = {
      mapped: false,
      fixtureId: null as number | null,
      statistics: false,
      headToHead: false,
      injuries: false,
      predictions: false,
      teamStats: false,
      standings: false,
      lineups: false,
      marketOdds: false,
    }

    try {
      // Get match with API-Football IDs and league info
      let match = await prisma.matches.findUnique({
        where: { id: matchId },
        select: {
          id: true,
          start_time: true,
          api_football_fixture_id: true,
          api_football_home_team_id: true,
          api_football_away_team_id: true,
          api_football_league_id: true,
        },
      })

      if (!match) {
        return { ...result, error: 'Match not found' }
      }

      // If not mapped, try to map it first
      if (!match.api_football_home_team_id || !match.api_football_away_team_id) {
        console.log(`[MatchEnrichment] Match ${matchId} not mapped, attempting enrichment...`)
        const enrichResult = await this.enrichMatch(matchId)

        if (!enrichResult.success) {
          return { ...result, error: enrichResult.error || 'Failed to map match to API-Football' }
        }

        // Refresh match data after enrichment
        match = await prisma.matches.findUnique({
          where: { id: matchId },
          select: {
            id: true,
            start_time: true,
            api_football_fixture_id: true,
            api_football_home_team_id: true,
            api_football_away_team_id: true,
            api_football_league_id: true,
          },
        })

        if (!match) {
          return { ...result, error: 'Match not found after enrichment' }
        }
      }

      result.mapped = !!(match.api_football_home_team_id && match.api_football_away_team_id)
      result.fixtureId = match.api_football_fixture_id

      if (!result.mapped) {
        return { ...result, error: 'Could not map teams to API-Football' }
      }

      const homeTeamId = match.api_football_home_team_id!
      const awayTeamId = match.api_football_away_team_id!
      const fixtureId = match.api_football_fixture_id
      const leagueId = match.api_football_league_id
      const season = new Date(match.start_time).getFullYear()

      // Fetch all data types in parallel
      const [
        statsResult,
        h2hResult,
        injuriesResult,
        predictionsResult,
        teamStatsResult,
        standingsResult,
        lineupsResult,
        marketOddsResult,
      ] = await Promise.all([
        // Statistics (requires fixture ID)
        fixtureId
          ? this.fetchAndStoreStatistics(matchId, fixtureId).catch(err => {
              console.warn(`[MatchEnrichment] Statistics fetch failed:`, err)
              return false
            })
          : Promise.resolve(false),
        // Head-to-head
        this.fetchAndStoreH2H(matchId, homeTeamId, awayTeamId).catch(err => {
          console.warn(`[MatchEnrichment] H2H fetch failed:`, err)
          return false
        }),
        // Injuries (season required for team-based queries)
        this.fetchAndStoreInjuries(
          matchId,
          homeTeamId,
          awayTeamId,
          fixtureId || undefined,
          season
        ).catch(err => {
          console.warn(`[MatchEnrichment] Injuries fetch failed:`, err)
          return false
        }),
        // Predictions (requires fixture ID)
        fixtureId
          ? this.fetchAndStorePredictions(matchId, fixtureId).catch(err => {
              console.warn(`[MatchEnrichment] Predictions fetch failed:`, err)
              return false
            })
          : Promise.resolve(false),
        // Team season stats (requires league ID)
        leagueId
          ? this.fetchAndStoreTeamSeasonStats(
              matchId,
              homeTeamId,
              awayTeamId,
              leagueId,
              season
            ).catch(err => {
              console.warn(`[MatchEnrichment] Team stats fetch failed:`, err)
              return false
            })
          : Promise.resolve(false),
        // Standings (requires league ID)
        leagueId
          ? this.fetchAndStoreStandings(matchId, leagueId, season).catch(err => {
              console.warn(`[MatchEnrichment] Standings fetch failed:`, err)
              return false
            })
          : Promise.resolve(false),
        // Lineups (requires fixture ID, usually available 1h before kickoff)
        fixtureId
          ? this.fetchAndStoreLineups(matchId, fixtureId).catch(err => {
              console.warn(`[MatchEnrichment] Lineups fetch failed:`, err)
              return false
            })
          : Promise.resolve(false),
        // Market odds (requires fixture ID)
        fixtureId
          ? this.fetchAndStoreMarketOdds(matchId, fixtureId).catch(err => {
              console.warn(`[MatchEnrichment] Market odds fetch failed:`, err)
              return false
            })
          : Promise.resolve(false),
      ])

      result.statistics = statsResult
      result.headToHead = h2hResult
      result.injuries = injuriesResult
      result.predictions = predictionsResult
      result.teamStats = teamStatsResult
      result.standings = standingsResult
      result.lineups = lineupsResult
      result.marketOdds = marketOddsResult

      console.log(
        `[MatchEnrichment] fetchAllDataForMatch(${matchId}): stats=${result.statistics}, h2h=${result.headToHead}, injuries=${result.injuries}, predictions=${result.predictions}, teamStats=${result.teamStats}, standings=${result.standings}, lineups=${result.lineups}, marketOdds=${result.marketOdds}`
      )

      return result
    } catch (error) {
      console.error(`[MatchEnrichment] fetchAllDataForMatch error:`, error)
      return { ...result, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // ==========================================================================
  // Automatic Data Fetching Methods
  // ==========================================================================

  /**
   * Check if a match has fresh data for specific data types.
   * Returns freshness status for each requested data type.
   */
  async hasFreshData(
    matchId: number,
    dataTypes: string[] = ['headToHead', 'statistics', 'team_season_stats', 'standings']
  ): Promise<DataFreshnessResult[]> {
    const now = new Date()

    const existingData = await prisma.match_scraped_data.findMany({
      where: {
        match_id: matchId,
        data_type: { in: dataTypes },
      },
      select: {
        data_type: true,
        scraped_at: true,
        source: true,
        is_stale: true,
      },
    })

    const dataMap = new Map(existingData.map(d => [d.data_type, d]))

    return dataTypes.map(dataType => {
      const data = dataMap.get(dataType)
      if (!data) {
        return {
          dataType,
          exists: false,
          isFresh: false,
          scrapedAt: null,
          source: null,
        }
      }

      const cacheTtl = CACHE_TTL_BY_TYPE[dataType] || STATISTICS_CACHE_TTL
      const ageSeconds = (now.getTime() - data.scraped_at.getTime()) / 1000
      const isFresh = !data.is_stale && ageSeconds < cacheTtl

      return {
        dataType,
        exists: true,
        isFresh,
        scrapedAt: data.scraped_at,
        source: data.source,
      }
    })
  }

  /**
   * Check what data is missing or stale for a match.
   * Used to determine if data fetching is needed before prediction.
   */
  async ensureMatchData(
    matchId: number,
    requiredDataTypes: string[] = ['headToHead', 'statistics']
  ): Promise<EnsureDataResult> {
    const freshnessResults = await this.hasFreshData(matchId, requiredDataTypes)

    const missing = freshnessResults.filter(r => !r.exists).map(r => r.dataType)
    const stale = freshnessResults.filter(r => r.exists && !r.isFresh).map(r => r.dataType)
    const hasFreshData = missing.length === 0 && stale.length === 0

    return {
      matchId,
      hasFreshData,
      missing,
      stale,
      details: freshnessResults,
    }
  }

  /**
   * Check if auto-fetch should be skipped due to quota.
   * Returns true if quota usage is above threshold.
   */
  private isQuotaExhausted(): boolean {
    const status = this.client.getDailyQuotaStatus()
    const usagePercent = (status.used / status.limit) * 100
    return usagePercent >= QUOTA_THRESHOLD_PERCENT
  }

  /**
   * Fetch match data if needed (missing or stale).
   * Combines check + fetch into a single callable function.
   * Used by both draw sync and prediction flows.
   *
   * @param matchId - The match ID
   * @param options - Options for fetching
   * @returns Object indicating if data was fetched and success status
   */
  async fetchMatchDataIfNeeded(
    matchId: number,
    options: {
      skipQuotaCheck?: boolean
      skipFinishedMatches?: boolean
      dataTypes?: string[]
    } = {}
  ): Promise<{
    needed: boolean
    fetched: boolean
    skipped: boolean
    reason?: string
    result?: FetchDataResult
  }> {
    const {
      skipQuotaCheck = false,
      skipFinishedMatches = true,
      dataTypes = ['headToHead', 'statistics'],
    } = options

    // Check if match is finished
    if (skipFinishedMatches) {
      const match = await prisma.matches.findUnique({
        where: { id: matchId },
        select: { status: true },
      })

      if (match?.status === 'FT') {
        return { needed: false, fetched: false, skipped: true, reason: 'Match is finished' }
      }
    }

    // Check if data is already fresh
    const dataStatus = await this.ensureMatchData(matchId, dataTypes)

    if (dataStatus.hasFreshData) {
      return { needed: false, fetched: false, skipped: false }
    }

    // Check quota
    if (!skipQuotaCheck && this.isQuotaExhausted()) {
      console.warn(
        `[MatchEnrichment] Skipping auto-fetch for match ${matchId}: quota threshold (${QUOTA_THRESHOLD_PERCENT}%) exceeded`
      )
      return { needed: true, fetched: false, skipped: true, reason: 'Quota threshold exceeded' }
    }

    // Fetch data
    console.log(
      `[MatchEnrichment] Fetching data for match ${matchId}: missing=[${dataStatus.missing.join(',')}], stale=[${dataStatus.stale.join(',')}]`
    )

    const result = await this.fetchAllDataForMatch(matchId)

    return {
      needed: true,
      fetched: !result.error,
      skipped: false,
      result,
    }
  }

  /**
   * Automatically fetch data after successful enrichment.
   * Called after enrichMatch() when auto-fetch is enabled.
   * Runs in background (non-blocking).
   */
  async fetchDataAfterEnrichment(matchId: number): Promise<void> {
    try {
      const fetchResult = await this.fetchMatchDataIfNeeded(matchId, {
        skipQuotaCheck: false,
        skipFinishedMatches: true,
        dataTypes: ['headToHead', 'statistics', 'team_season_stats', 'standings'],
      })

      if (fetchResult.skipped) {
        console.log(
          `[MatchEnrichment] Auto-fetch skipped for match ${matchId}: ${fetchResult.reason}`
        )
      } else if (fetchResult.fetched) {
        console.log(`[MatchEnrichment] Auto-fetch completed for match ${matchId}`)
      }
    } catch (error) {
      console.warn(`[MatchEnrichment] Auto-fetch failed for match ${matchId}:`, error)
    }
  }

  /**
   * Fetch all data types sequentially with delays between requests.
   * This is the rate-limited version used for automatic fetching.
   */
  async fetchAllDataForMatchSequential(matchId: number): Promise<FetchDataResult> {
    const result = {
      mapped: false,
      fixtureId: null as number | null,
      statistics: false,
      headToHead: false,
      injuries: false,
      predictions: false,
      teamStats: false,
      standings: false,
      lineups: false,
      marketOdds: false,
    }

    try {
      // Get match with API-Football IDs and league info
      let match = await prisma.matches.findUnique({
        where: { id: matchId },
        select: {
          id: true,
          start_time: true,
          api_football_fixture_id: true,
          api_football_home_team_id: true,
          api_football_away_team_id: true,
          api_football_league_id: true,
        },
      })

      if (!match) {
        return { ...result, error: 'Match not found' }
      }

      // If not mapped, try to map it first
      if (!match.api_football_home_team_id || !match.api_football_away_team_id) {
        console.log(`[MatchEnrichment] Match ${matchId} not mapped, attempting enrichment...`)
        const enrichResult = await this.enrichMatch(matchId)

        if (!enrichResult.success) {
          return { ...result, error: enrichResult.error || 'Failed to map match to API-Football' }
        }

        // Refresh match data after enrichment
        match = await prisma.matches.findUnique({
          where: { id: matchId },
          select: {
            id: true,
            start_time: true,
            api_football_fixture_id: true,
            api_football_home_team_id: true,
            api_football_away_team_id: true,
            api_football_league_id: true,
          },
        })

        if (!match) {
          return { ...result, error: 'Match not found after enrichment' }
        }
      }

      result.mapped = !!(match.api_football_home_team_id && match.api_football_away_team_id)
      result.fixtureId = match.api_football_fixture_id

      if (!result.mapped) {
        return { ...result, error: 'Could not map teams to API-Football' }
      }

      const homeTeamId = match.api_football_home_team_id!
      const awayTeamId = match.api_football_away_team_id!
      const fixtureId = match.api_football_fixture_id
      const leagueId = match.api_football_league_id
      const season = new Date(match.start_time).getFullYear()

      // Fetch data types sequentially with delays (priority order from design.md)

      // 1. Head-to-head (highest priority)
      try {
        result.headToHead = await this.fetchAndStoreH2H(matchId, homeTeamId, awayTeamId)
      } catch (err) {
        console.warn(`[MatchEnrichment] H2H fetch failed:`, err)
      }
      await delay(REQUEST_DELAY_MS)

      // 2. Team season stats
      if (leagueId) {
        try {
          result.teamStats = await this.fetchAndStoreTeamSeasonStats(
            matchId,
            homeTeamId,
            awayTeamId,
            leagueId,
            season
          )
        } catch (err) {
          console.warn(`[MatchEnrichment] Team stats fetch failed:`, err)
        }
        await delay(REQUEST_DELAY_MS)
      }

      // 3. Standings
      if (leagueId) {
        try {
          result.standings = await this.fetchAndStoreStandings(matchId, leagueId, season)
        } catch (err) {
          console.warn(`[MatchEnrichment] Standings fetch failed:`, err)
        }
        await delay(REQUEST_DELAY_MS)
      }

      // 4. Statistics
      if (fixtureId) {
        try {
          result.statistics = await this.fetchAndStoreStatistics(matchId, fixtureId)
        } catch (err) {
          console.warn(`[MatchEnrichment] Statistics fetch failed:`, err)
        }
        await delay(REQUEST_DELAY_MS)
      }

      // 5. Injuries (season required for team-based queries)
      try {
        result.injuries = await this.fetchAndStoreInjuries(
          matchId,
          homeTeamId,
          awayTeamId,
          fixtureId || undefined,
          season
        )
      } catch (err) {
        console.warn(`[MatchEnrichment] Injuries fetch failed:`, err)
      }
      await delay(REQUEST_DELAY_MS)

      // 6. Predictions
      if (fixtureId) {
        try {
          result.predictions = await this.fetchAndStorePredictions(matchId, fixtureId)
        } catch (err) {
          console.warn(`[MatchEnrichment] Predictions fetch failed:`, err)
        }
        await delay(REQUEST_DELAY_MS)
      }

      // 7. Lineups (usually not available until close to kickoff)
      if (fixtureId) {
        try {
          result.lineups = await this.fetchAndStoreLineups(matchId, fixtureId)
        } catch (err) {
          console.warn(`[MatchEnrichment] Lineups fetch failed:`, err)
        }
        await delay(REQUEST_DELAY_MS)
      }

      // 8. Market odds (requires fixture ID)
      if (fixtureId) {
        try {
          result.marketOdds = await this.fetchAndStoreMarketOdds(matchId, fixtureId)
        } catch (err) {
          console.warn(`[MatchEnrichment] Market odds fetch failed:`, err)
        }
      }

      console.log(
        `[MatchEnrichment] fetchAllDataForMatchSequential(${matchId}): h2h=${result.headToHead}, stats=${result.statistics}, teamStats=${result.teamStats}, standings=${result.standings}, injuries=${result.injuries}, predictions=${result.predictions}, lineups=${result.lineups}, marketOdds=${result.marketOdds}`
      )

      return result
    } catch (error) {
      console.error(`[MatchEnrichment] fetchAllDataForMatchSequential error:`, error)
      return { ...result, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let serviceInstance: MatchEnrichmentService | null = null

export function getMatchEnrichmentService(): MatchEnrichmentService {
  if (!serviceInstance) {
    serviceInstance = new MatchEnrichmentService()
  }
  return serviceInstance
}
