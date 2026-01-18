/**
 * API-Football Data Provider
 *
 * Fetches match data from API-Football and normalizes it to the
 * common provider interface.
 */

import type { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { getApiFootballClient } from '../api-football/client'
import { getTeamMatcher } from '../api-football/team-matcher'
import type {
  ApiFootballTeamStatistics,
  ApiFootballInjury,
  ApiFootballH2HResponse,
  ApiFootballFixtureResponse,
  ApiFootballSeasonStatisticsResponse,
  ApiFootballStatistic,
} from '../api-football/types'
import type {
  MatchDataProvider,
  MatchStatistics,
  PlayerInjury,
  TeamStatistics,
  HeadToHeadData,
  DataSource,
  TeamMatchStats,
  HistoricalMatch,
} from './types'

// ============================================================================
// Constants
// ============================================================================

const STATISTICS_CACHE_TTL = 24 * 60 * 60 // 24 hours (completed matches don't change)
const INJURIES_CACHE_TTL = 60 * 60 // 1 hour (injuries can change)
const TEAM_STATS_CACHE_TTL = 24 * 60 * 60 // 24 hours
const H2H_CACHE_TTL = 30 * 24 * 60 * 60 // 30 days (historical data rarely changes)

// ============================================================================
// Types
// ============================================================================

type MatchWithTeams = Prisma.matchesGetPayload<{
  include: { homeTeam: true; awayTeam: true }
}>

// ============================================================================
// Provider Implementation
// ============================================================================

export class ApiFootballProvider implements MatchDataProvider {
  readonly name = 'ApiFootballProvider'
  readonly source: DataSource = 'api-football'
  readonly priority = 1 // Highest priority

  private client = getApiFootballClient()
  private teamMatcher = getTeamMatcher()

  async getStatistics(matchId: number): Promise<MatchStatistics | null> {
    // Get match from database to find API-Football fixture ID
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    })

    if (!match) {
      console.warn(`[ApiFootballProvider] Match ${matchId} not found in database`)
      return null
    }

    // If we don't have an API-Football fixture ID, try to find it
    let fixtureId = match.api_football_fixture_id

    if (!fixtureId) {
      // Try to match the fixture by teams and date
      fixtureId = await this.findFixtureId(match)
      if (!fixtureId) {
        console.warn(
          `[ApiFootballProvider] Could not find API-Football fixture for match ${matchId}`
        )
        return null
      }

      // Store the fixture ID for future use
      await prisma.matches.update({
        where: { id: matchId },
        data: { api_football_fixture_id: fixtureId },
      })
    }

    // Fetch statistics from API-Football
    const response = await this.client.get<ApiFootballTeamStatistics[]>(
      '/fixtures/statistics',
      { fixture: fixtureId },
      { cacheTtlSeconds: STATISTICS_CACHE_TTL }
    )

    if (!response.response || response.response.length === 0) {
      return null
    }

    // Parse and normalize statistics
    const homeStats = response.response.find(s => s.team.id === match.api_football_home_team_id)
    const awayStats = response.response.find(s => s.team.id === match.api_football_away_team_id)

    // If we don't have mapped team IDs, use the first two
    const stats = response.response
    const home = homeStats || stats[0]
    const away = awayStats || stats[1]

    if (!home || !away) {
      return null
    }

    const result: MatchStatistics = {
      matchId,
      homeTeam: this.parseTeamStats(match.home_team_id, match.homeTeam.name, home.statistics),
      awayTeam: this.parseTeamStats(match.away_team_id, match.awayTeam.name, away.statistics),
      source: 'api-football',
      fetchedAt: new Date(),
    }

    // Store in database for caching
    await this.storeMatchData(matchId, 'statistics', result)

    return result
  }

  async getInjuries(teamId: number): Promise<PlayerInjury[]> {
    // Get API-Football team ID
    const mapping = await prisma.team_mappings.findUnique({
      where: { svenska_spel_team_id: teamId },
    })

    if (!mapping) {
      console.warn(`[ApiFootballProvider] No mapping for team ${teamId}`)
      return []
    }

    // Fetch injuries from API-Football
    const response = await this.client.get<ApiFootballInjury[]>(
      '/injuries',
      { team: mapping.api_football_team_id },
      { cacheTtlSeconds: INJURIES_CACHE_TTL }
    )

    if (!response.response || response.response.length === 0) {
      return []
    }

    // Get team name
    const team = await prisma.teams.findUnique({
      where: { id: teamId },
    })

    const injuries: PlayerInjury[] = response.response.map(injury => ({
      playerId: injury.player.id,
      playerName: injury.player.name,
      teamId,
      teamName: team?.name || '',
      reason: injury.player.reason,
      type: injury.player.type,
      severity: this.parseSeverity(injury.player.type),
      source: 'api-football',
    }))

    // Store in database
    await this.storeMatchData(null, 'injuries', { teamId, injuries })

    return injuries
  }

  async getTeamStats(teamId: number, season?: number): Promise<TeamStatistics | null> {
    const currentSeason = season || new Date().getFullYear()

    // Get API-Football team and league IDs
    const mapping = await prisma.team_mappings.findUnique({
      where: { svenska_spel_team_id: teamId },
    })

    if (!mapping) {
      console.warn(`[ApiFootballProvider] No mapping for team ${teamId}`)
      return null
    }

    // We need league ID for team statistics - get it from a recent match
    const recentMatch = await prisma.matches.findFirst({
      where: {
        OR: [{ home_team_id: teamId }, { away_team_id: teamId }],
        api_football_league_id: { not: null },
      },
      orderBy: { start_time: 'desc' },
    })

    if (!recentMatch?.api_football_league_id) {
      console.warn(`[ApiFootballProvider] No league mapping for team ${teamId}`)
      return null
    }

    // Fetch team statistics from API-Football
    const response = await this.client.get<ApiFootballSeasonStatisticsResponse>(
      '/teams/statistics',
      {
        team: mapping.api_football_team_id,
        league: recentMatch.api_football_league_id,
        season: currentSeason,
      },
      { cacheTtlSeconds: TEAM_STATS_CACHE_TTL }
    )

    if (!response.response) {
      return null
    }

    const data = response.response
    const team = await prisma.teams.findUnique({ where: { id: teamId } })

    const result: TeamStatistics = {
      teamId,
      teamName: team?.name || data.team?.name || '',
      season: currentSeason,
      form: data.form || '',
      played: data.fixtures?.played?.total || 0,
      wins: data.fixtures?.wins?.total || 0,
      draws: data.fixtures?.draws?.total || 0,
      losses: data.fixtures?.loses?.total || 0,
      goalsFor: data.goals?.for?.total?.total || 0,
      goalsAgainst: data.goals?.against?.total?.total || 0,
      goalDifference:
        (data.goals?.for?.total?.total || 0) - (data.goals?.against?.total?.total || 0),
      points: (data.fixtures?.wins?.total || 0) * 3 + (data.fixtures?.draws?.total || 0),
      homeRecord: {
        played: data.fixtures?.played?.home || 0,
        wins: data.fixtures?.wins?.home || 0,
        draws: data.fixtures?.draws?.home || 0,
        losses: data.fixtures?.loses?.home || 0,
        goalsFor: data.goals?.for?.total?.home || 0,
        goalsAgainst: data.goals?.against?.total?.home || 0,
      },
      awayRecord: {
        played: data.fixtures?.played?.away || 0,
        wins: data.fixtures?.wins?.away || 0,
        draws: data.fixtures?.draws?.away || 0,
        losses: data.fixtures?.loses?.away || 0,
        goalsFor: data.goals?.for?.total?.away || 0,
        goalsAgainst: data.goals?.against?.total?.away || 0,
      },
      cleanSheets: data.clean_sheet?.total || 0,
      failedToScore: data.failed_to_score?.total || 0,
      source: 'api-football',
    }

    return result
  }

  async getHeadToHead(team1Id: number, team2Id: number): Promise<HeadToHeadData | null> {
    // Get API-Football team IDs
    const [mapping1, mapping2] = await Promise.all([
      prisma.team_mappings.findUnique({ where: { svenska_spel_team_id: team1Id } }),
      prisma.team_mappings.findUnique({ where: { svenska_spel_team_id: team2Id } }),
    ])

    if (!mapping1 || !mapping2) {
      console.warn(`[ApiFootballProvider] Missing team mapping for H2H: ${team1Id} or ${team2Id}`)
      return null
    }

    // Fetch H2H from API-Football
    const response = await this.client.get<ApiFootballH2HResponse[]>(
      '/fixtures/headtohead',
      { h2h: `${mapping1.api_football_team_id}-${mapping2.api_football_team_id}` },
      { cacheTtlSeconds: H2H_CACHE_TTL }
    )

    if (!response.response || response.response.length === 0) {
      return null
    }

    // Get team names
    const [team1, team2] = await Promise.all([
      prisma.teams.findUnique({ where: { id: team1Id } }),
      prisma.teams.findUnique({ where: { id: team2Id } }),
    ])

    // Parse matches
    const lastMatches: HistoricalMatch[] = response.response.slice(0, 10).map(fixture => ({
      date: new Date(fixture.fixture.date),
      homeTeamId: fixture.teams.home.id === mapping1.api_football_team_id ? team1Id : team2Id,
      awayTeamId: fixture.teams.away.id === mapping1.api_football_team_id ? team1Id : team2Id,
      homeTeamName: fixture.teams.home.name,
      awayTeamName: fixture.teams.away.name,
      scoreHome: fixture.goals.home || 0,
      scoreAway: fixture.goals.away || 0,
      venue: fixture.fixture.venue?.name,
      league: fixture.league?.name,
    }))

    // Calculate wins/draws
    let team1Wins = 0
    let team2Wins = 0
    let draws = 0

    for (const match of lastMatches) {
      if (match.scoreHome === match.scoreAway) {
        draws++
      } else if (
        (match.homeTeamId === team1Id && match.scoreHome > match.scoreAway) ||
        (match.awayTeamId === team1Id && match.scoreAway > match.scoreHome)
      ) {
        team1Wins++
      } else {
        team2Wins++
      }
    }

    return {
      team1Id,
      team2Id,
      team1Name: team1?.name || '',
      team2Name: team2?.name || '',
      lastMatches,
      team1Wins,
      draws,
      team2Wins,
      totalMatches: response.response.length,
      source: 'api-football',
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.client.isConfigured() && !this.client.isCircuitOpen()
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private async findFixtureId(match: MatchWithTeams): Promise<number | null> {
    // Try to find fixture by teams and date
    const matchDate = new Date(match.start_time)
    const dateStr = matchDate.toISOString().split('T')[0]!

    let homeTeamId = match.api_football_home_team_id
    let awayTeamId = match.api_football_away_team_id

    // Get API-Football team IDs if not already mapped
    if (!homeTeamId || !awayTeamId) {
      const [homeMapping, awayMapping] = await Promise.all([
        this.teamMatcher.matchTeamById(match.home_team_id, match.homeTeam.name, {
          leagueId: match.league_id,
        }),
        this.teamMatcher.matchTeamById(match.away_team_id, match.awayTeam.name, {
          leagueId: match.league_id,
        }),
      ])

      if (!homeMapping || !awayMapping) {
        return null
      }

      homeTeamId = homeMapping.apiFootballTeamId
      awayTeamId = awayMapping.apiFootballTeamId

      // Store the mappings on the match
      await prisma.matches.update({
        where: { id: match.id },
        data: {
          api_football_home_team_id: homeTeamId,
          api_football_away_team_id: awayTeamId,
        },
      })

      match.api_football_home_team_id = homeTeamId
      match.api_football_away_team_id = awayTeamId
    }

    // Search for fixture by date and teams
    const response = await this.client.get<ApiFootballFixtureResponse[]>(
      '/fixtures',
      {
        date: dateStr,
        team: homeTeamId,
      },
      { cacheTtlSeconds: H2H_CACHE_TTL }
    )

    if (!response.response || response.response.length === 0) {
      return null
    }

    // Find the matching fixture
    const fixture = response.response.find(
      f => f.teams.home.id === homeTeamId && f.teams.away.id === awayTeamId
    )

    return fixture?.fixture.id || null
  }

  private parseTeamStats(
    teamId: number,
    teamName: string,
    stats: ApiFootballStatistic[]
  ): TeamMatchStats {
    const getValue = (type: string): number => {
      const stat = stats.find(s => s.type === type)
      if (!stat || stat.value === null) return 0
      if (typeof stat.value === 'string') {
        // Handle percentage strings like "55%"
        return parseInt(stat.value.replace('%', ''), 10) || 0
      }
      return stat.value
    }

    return {
      teamId,
      teamName,
      shots: {
        total: getValue('Total Shots') || getValue('Shots on Goal') + getValue('Shots off Goal'),
        onTarget: getValue('Shots on Goal'),
      },
      possession: getValue('Ball Possession'),
      passes: {
        total: getValue('Total passes'),
        accurate: getValue('Passes accurate'),
        percentage: getValue('Passes %'),
      },
      fouls: getValue('Fouls'),
      corners: getValue('Corner Kicks'),
      offsides: getValue('Offsides'),
      yellowCards: getValue('Yellow Cards'),
      redCards: getValue('Red Cards'),
    }
  }

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

  private async storeMatchData(
    matchId: number | null,
    dataType: string,
    data: unknown
  ): Promise<void> {
    if (matchId) {
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
  }
}
