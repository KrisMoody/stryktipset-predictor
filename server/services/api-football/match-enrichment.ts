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
} from './types'

// ============================================================================
// Cache TTLs
// ============================================================================

const STATISTICS_CACHE_TTL = 24 * 60 * 60 // 24 hours
const H2H_CACHE_TTL = 30 * 24 * 60 * 60 // 30 days (historical data)
const INJURIES_CACHE_TTL = 60 * 60 // 1 hour (injuries change frequently)

// ============================================================================
// Types
// ============================================================================

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
      }

      if (
        apiFootballConfig?.enabled &&
        apiFootballConfig?.fetchDuringEnrichment &&
        apiHomeTeamId &&
        apiAwayTeamId
      ) {
        const dataTypes = apiFootballConfig.dataTypes || ['statistics', 'headToHead', 'injuries']
        result.dataFetched = { statistics: false, headToHead: false, injuries: false }

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
            const fetched = await this.fetchAndStoreInjuries(
              matchId,
              apiHomeTeamId,
              apiAwayTeamId,
              apiFixtureId || undefined
            )
            result.dataFetched.injuries = fetched
          } catch (error) {
            console.warn(`[MatchEnrichment] Error fetching injuries for match ${matchId}:`, error)
          }
        }

        console.log(
          `[MatchEnrichment] Data fetched for match ${matchId}: stats=${result.dataFetched.statistics}, h2h=${result.dataFetched.headToHead}, injuries=${result.dataFetched.injuries}`
        )
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
    fixtureId?: number
  ): Promise<boolean> {
    if (!this.client.isConfigured() || this.client.isCircuitOpen()) {
      return false
    }

    try {
      // Fetch injuries for both teams
      const params: Record<string, string | number> = {}
      if (fixtureId) {
        params.fixture = fixtureId
      } else {
        // If no fixture ID, fetch by teams (less accurate but works for upcoming matches)
        params.team = homeTeamId
      }

      const [homeInjuries, awayInjuries] = await Promise.all([
        this.client.get<ApiFootballInjury[]>(
          '/injuries',
          fixtureId ? { fixture: fixtureId } : { team: homeTeamId },
          { cacheTtlSeconds: INJURIES_CACHE_TTL }
        ),
        fixtureId
          ? Promise.resolve({ response: [] as ApiFootballInjury[] }) // Fixture-based query returns both teams
          : this.client.get<ApiFootballInjury[]>(
              '/injuries',
              { team: awayTeamId },
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
      const normalizedInjuries = allInjuries.map(injury => ({
        playerId: injury.player.id,
        playerName: injury.player.name,
        teamId: injury.team.id,
        teamName: injury.team.name,
        type: injury.player.type, // 'Missing Fixture', 'Questionable', etc.
        reason: injury.player.reason, // 'Injury', 'Suspended', etc.
        severity: this.parseSeverity(injury.player.type),
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
   * Parse injury severity from type string
   */
  private parseSeverity(type: string): 'minor' | 'moderate' | 'severe' {
    const typeLower = type.toLowerCase()
    if (typeLower.includes('questionable') || typeLower.includes('doubt')) {
      return 'minor'
    }
    if (typeLower.includes('out') || typeLower.includes('missing')) {
      return 'severe'
    }
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
