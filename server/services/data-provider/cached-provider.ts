/**
 * Cached Data Provider
 *
 * Returns data from database cache. Used as last resort fallback
 * when API-Football and web scraping both fail.
 */

import { prisma } from '~/server/utils/prisma'
import type {
  MatchDataProvider,
  MatchStatistics,
  PlayerInjury,
  TeamStatistics,
  HeadToHeadData,
  DataSource,
  TeamMatchStats,
} from './types'

// Type helpers for cached JSON data
interface CachedStatisticsData {
  homeTeam?: TeamMatchStats
  awayTeam?: TeamMatchStats
  homeTeamId?: number
  homeTeamName?: string
  awayTeamId?: number
  awayTeamName?: string
}

interface CachedInjuryData {
  playerId: number
  playerName: string
  teamId: number
  teamName?: string
  reason?: string
  type?: string
  severity?: 'minor' | 'moderate' | 'severe'
}

interface CachedTeamData {
  id?: number
  name?: string
  form?: string
  played?: number
  wins?: number
  draws?: number
  losses?: number
  goalsFor?: number
  goalsAgainst?: number
  cleanSheets?: number
  failedToScore?: number
  homeRecord?: {
    played?: number
    wins?: number
    draws?: number
    losses?: number
    goalsFor?: number
    goalsAgainst?: number
  }
  awayRecord?: {
    played?: number
    wins?: number
    draws?: number
    losses?: number
    goalsFor?: number
    goalsAgainst?: number
  }
}

interface CachedTeamStatsData {
  homeTeam?: CachedTeamData
  awayTeam?: CachedTeamData
}

interface CachedH2HMatch {
  date?: string
  homeTeamId?: number
  awayTeamId?: number
  homeTeamName?: string
  awayTeamName?: string
  scoreHome?: number
  scoreAway?: number
  venue?: string
  league?: string
}

interface CachedH2HData {
  team1Id?: number
  team2Id?: number
  team1Name?: string
  team2Name?: string
  lastMatches?: CachedH2HMatch[]
  team1Wins?: number
  draws?: number
  team2Wins?: number
  totalMatches?: number
}

export class CachedDataProvider implements MatchDataProvider {
  readonly name = 'CachedDataProvider'
  readonly source: DataSource = 'cache'
  readonly priority = 100 // Lowest priority - last resort

  async getStatistics(matchId: number): Promise<MatchStatistics | null> {
    const cached = await prisma.match_scraped_data.findFirst({
      where: {
        match_id: matchId,
        data_type: 'statistics',
        is_stale: false,
      },
      orderBy: { scraped_at: 'desc' },
    })

    if (!cached) return null

    const data = cached.data as unknown as CachedStatisticsData

    return {
      matchId,
      homeTeam:
        data.homeTeam || this.createEmptyTeamStats(data.homeTeamId || 0, data.homeTeamName || ''),
      awayTeam:
        data.awayTeam || this.createEmptyTeamStats(data.awayTeamId || 0, data.awayTeamName || ''),
      source: 'cache',
      fetchedAt: cached.scraped_at,
    }
  }

  async getInjuries(teamId: number): Promise<PlayerInjury[]> {
    // Check match_scraped_data for injury data
    const cached = await prisma.match_scraped_data.findMany({
      where: {
        data_type: 'injuries',
        is_stale: false,
      },
      orderBy: { scraped_at: 'desc' },
      take: 10, // Get recent injury data
    })

    const injuries: PlayerInjury[] = []

    for (const record of cached) {
      const data = record.data as unknown as CachedInjuryData[]
      if (Array.isArray(data)) {
        for (const injury of data) {
          if (injury.teamId === teamId) {
            injuries.push({
              playerId: injury.playerId,
              playerName: injury.playerName,
              teamId: injury.teamId,
              teamName: injury.teamName || '',
              reason: injury.reason || 'Unknown',
              type: injury.type || 'Missing Fixture',
              severity: injury.severity || 'moderate',
              expectedReturn: undefined,
              source: 'cache',
            })
          }
        }
      }
    }

    return injuries
  }

  async getTeamStats(teamId: number, _season?: number): Promise<TeamStatistics | null> {
    // Look for cached team statistics
    const cached = await prisma.match_scraped_data.findFirst({
      where: {
        data_type: { in: ['teamStats', 'xStats'] },
        is_stale: false,
      },
      orderBy: { scraped_at: 'desc' },
    })

    if (!cached) return null

    const data = cached.data as unknown as CachedTeamStatsData

    // Try to extract team-specific stats
    const teamData =
      data.homeTeam?.id === teamId
        ? data.homeTeam
        : data.awayTeam?.id === teamId
          ? data.awayTeam
          : null

    if (!teamData) return null

    return {
      teamId,
      teamName: teamData.name || '',
      season: new Date().getFullYear(),
      form: teamData.form || '',
      played: teamData.played || 0,
      wins: teamData.wins || 0,
      draws: teamData.draws || 0,
      losses: teamData.losses || 0,
      goalsFor: teamData.goalsFor || 0,
      goalsAgainst: teamData.goalsAgainst || 0,
      goalDifference: (teamData.goalsFor || 0) - (teamData.goalsAgainst || 0),
      points: (teamData.wins || 0) * 3 + (teamData.draws || 0),
      homeRecord: {
        played: teamData.homeRecord?.played ?? 0,
        wins: teamData.homeRecord?.wins ?? 0,
        draws: teamData.homeRecord?.draws ?? 0,
        losses: teamData.homeRecord?.losses ?? 0,
        goalsFor: teamData.homeRecord?.goalsFor ?? 0,
        goalsAgainst: teamData.homeRecord?.goalsAgainst ?? 0,
      },
      awayRecord: {
        played: teamData.awayRecord?.played ?? 0,
        wins: teamData.awayRecord?.wins ?? 0,
        draws: teamData.awayRecord?.draws ?? 0,
        losses: teamData.awayRecord?.losses ?? 0,
        goalsFor: teamData.awayRecord?.goalsFor ?? 0,
        goalsAgainst: teamData.awayRecord?.goalsAgainst ?? 0,
      },
      cleanSheets: teamData.cleanSheets || 0,
      failedToScore: teamData.failedToScore || 0,
      source: 'cache',
    }
  }

  async getHeadToHead(team1Id: number, team2Id: number): Promise<HeadToHeadData | null> {
    // Look for cached H2H data
    const cached = await prisma.match_scraped_data.findFirst({
      where: {
        data_type: 'headToHead',
        is_stale: false,
      },
      orderBy: { scraped_at: 'desc' },
    })

    if (!cached) return null

    const data = cached.data as unknown as CachedH2HData

    // Verify it's for the right teams
    if (data.team1Id !== team1Id || data.team2Id !== team2Id) {
      // Try swapped
      if (data.team1Id !== team2Id || data.team2Id !== team1Id) {
        return null
      }
    }

    return {
      team1Id,
      team2Id,
      team1Name: data.team1Name || '',
      team2Name: data.team2Name || '',
      lastMatches: (data.lastMatches || []).map(m => ({
        date: new Date(m.date || Date.now()),
        homeTeamId: m.homeTeamId ?? 0,
        awayTeamId: m.awayTeamId ?? 0,
        homeTeamName: m.homeTeamName || '',
        awayTeamName: m.awayTeamName || '',
        scoreHome: m.scoreHome ?? 0,
        scoreAway: m.scoreAway ?? 0,
        venue: m.venue,
        league: m.league,
      })),
      team1Wins: data.team1Wins || 0,
      draws: data.draws || 0,
      team2Wins: data.team2Wins || 0,
      totalMatches: data.totalMatches || 0,
      source: 'cache',
    }
  }

  async isHealthy(): Promise<boolean> {
    // Cache is always "healthy" - it either has data or it doesn't
    try {
      await prisma.match_scraped_data.count({ take: 1 })
      return true
    } catch {
      return false
    }
  }

  private createEmptyTeamStats(teamId: number, teamName: string) {
    return {
      teamId,
      teamName,
      shots: { total: 0, onTarget: 0 },
      possession: 0,
      passes: { total: 0, accurate: 0, percentage: 0 },
      fouls: 0,
      corners: 0,
      offsides: 0,
      yellowCards: 0,
      redCards: 0,
    }
  }
}
