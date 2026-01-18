/**
 * Match Enrichment Service
 *
 * Enriches matches with API-Football data by:
 * 1. Matching teams and leagues to API-Football IDs
 * 2. Fetching fixture ID from API-Football
 * 3. Storing mappings for future use
 *
 * This service is called after matches are synced from Svenska Spel.
 */

import { prisma } from '~/server/utils/prisma'
import { getTeamMatcher } from './team-matcher'
import { getLeagueMatcher } from './league-matcher'
import { getApiFootballClient } from './client'
import type { ApiFootballFixtureResponse } from './types'

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
