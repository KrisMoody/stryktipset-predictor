/**
 * Team Matching Service
 *
 * Automatically matches Svenska Spel teams to API-Football teams using:
 * 1. Direct ID lookup (BetRadar/Kambi IDs)
 * 2. Fuzzy text matching within league context
 * 3. Manual override mappings
 *
 * Key optimization: Fetches entire league roster in one API call, then
 * does all matching locally from cache (zero additional API calls).
 */

import type { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { getApiFootballClient } from './client'
import { getLeagueMatcher } from './league-matcher'
import type {
  ApiFootballTeamResponse,
  TeamMapping,
  MatchCandidate,
  MatchConfidence,
  MatchMethod,
  UnmappedTeam,
} from './types'

// ============================================================================
// Constants
// ============================================================================

const LEAGUE_ROSTER_CACHE_TTL = 24 * 60 * 60 // 24 hours in seconds
const CURRENT_SEASON = new Date().getFullYear()

// Common team name variations and abbreviations
const TEAM_NAME_ALIASES: Record<string, string[]> = {
  'Manchester United': ['Man United', 'Man Utd', 'MUFC'],
  'Manchester City': ['Man City', 'MCFC'],
  'Tottenham Hotspur': ['Tottenham', 'Spurs'],
  'West Ham United': ['West Ham'],
  'Newcastle United': ['Newcastle'],
  'Brighton & Hove Albion': ['Brighton', 'Brighton Hove Albion'],
  'Wolverhampton Wanderers': ['Wolverhampton', 'Wolves'],
  'Nottingham Forest': ["Nott'm Forest", 'Nottingham'],
  'Sheffield United': ['Sheffield Utd'],
  'Atletico Madrid': ['Atletico', 'Atlético Madrid', 'Atlético de Madrid'],
  'Athletic Bilbao': ['Athletic Club', 'Athletic Bilbao'],
  'Real Sociedad': ['Real Sociedad San Sebastian'],
  'Bayern Munich': ['Bayern München', 'Bayern Munchen', 'FC Bayern'],
  'Borussia Dortmund': ['Dortmund', 'BVB'],
  'RB Leipzig': ['Leipzig', 'RasenBallsport Leipzig'],
  'Bayer Leverkusen': ['Leverkusen'],
  'Borussia Mönchengladbach': ['Monchengladbach', 'Gladbach', "M'gladbach"],
  'Paris Saint-Germain': ['Paris SG', 'PSG'],
  'Olympique Marseille': ['Marseille', 'OM'],
  'Olympique Lyon': ['Lyon', 'OL'],
  'Inter Milan': ['Inter', 'Internazionale', 'Inter Milano'],
  'AC Milan': ['Milan'],
  Juventus: ['Juve'],
  AIK: ['AIK Stockholm', 'AIK Solna'],
  'IFK Göteborg': ['IFK Gothenburg', 'Göteborg'],
  'Malmö FF': ['Malmo FF', 'Malmö'],
  Djurgården: ['Djurgårdens IF', 'Djurgarden'],
  Hammarby: ['Hammarby IF'],
  'IFK Norrköping': ['IFK Norrkoping', 'Norrköping'],
}

// ============================================================================
// Utility Functions
// ============================================================================

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  const firstRow = matrix[0]!
  for (let j = 0; j <= a.length; j++) {
    firstRow[j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    const currentRow = matrix[i]!
    const prevRow = matrix[i - 1]!
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        currentRow[j] = prevRow[j - 1]!
      } else {
        currentRow[j] = Math.min(prevRow[j - 1]! + 1, currentRow[j - 1]! + 1, prevRow[j]! + 1)
      }
    }
  }

  return matrix[b.length]![a.length]!
}

function calculateSimilarity(a: string, b: string): number {
  const normalA = normalizeString(a)
  const normalB = normalizeString(b)

  if (normalA === normalB) return 100

  // Check if one is a substring of the other
  if (normalA.includes(normalB) || normalB.includes(normalA)) {
    return 90
  }

  const distance = levenshteinDistance(normalA, normalB)
  const maxLength = Math.max(normalA.length, normalB.length)

  if (maxLength === 0) return 100

  return Math.round((1 - distance / maxLength) * 100)
}

function getConfidenceFromSimilarity(similarity: number): MatchConfidence {
  if (similarity >= 95) return 'high'
  if (similarity >= 80) return 'medium'
  return 'low'
}

/**
 * Check if a team name matches any alias
 */
function matchesAlias(teamName: string, apiTeamName: string): boolean {
  const normalizedInput = normalizeString(teamName)
  const normalizedApi = normalizeString(apiTeamName)

  // Check direct match
  if (normalizedInput === normalizedApi) return true

  // Check aliases
  for (const [canonical, aliases] of Object.entries(TEAM_NAME_ALIASES)) {
    const allNames = [canonical, ...aliases].map(normalizeString)

    if (allNames.includes(normalizedInput) && allNames.includes(normalizedApi)) {
      return true
    }
  }

  return false
}

// ============================================================================
// Team Matcher Service
// ============================================================================

export class TeamMatcher {
  private client = getApiFootballClient()
  private leagueMatcher = getLeagueMatcher()
  private leagueRosterCache: Map<number, ApiFootballTeamResponse[]> = new Map()

  /**
   * Get all teams for a league (cached)
   */
  async getLeagueTeams(
    apiFootballLeagueId: number,
    season: number = CURRENT_SEASON
  ): Promise<ApiFootballTeamResponse[]> {
    const cacheKey = apiFootballLeagueId

    // Check memory cache
    if (this.leagueRosterCache.has(cacheKey)) {
      return this.leagueRosterCache.get(cacheKey)!
    }

    // Fetch from API (will use DB cache if available)
    const response = await this.client.get<ApiFootballTeamResponse[]>(
      '/teams',
      { league: apiFootballLeagueId, season },
      { cacheTtlSeconds: LEAGUE_ROSTER_CACHE_TTL }
    )

    const teams = response.response
    this.leagueRosterCache.set(cacheKey, teams)

    return teams
  }

  /**
   * Match a team by Svenska Spel ID
   */
  async matchTeamById(
    svenskaSpelTeamId: number,
    teamName: string,
    options: {
      leagueId?: number
      leagueName?: string
      countryName?: string
      betradarId?: string
      kambiId?: string
    } = {}
  ): Promise<TeamMapping | null> {
    // Check for existing mapping
    const existing = await prisma.team_mappings.findUnique({
      where: { svenska_spel_team_id: svenskaSpelTeamId },
    })

    if (existing) {
      return {
        svenskaSpelTeamId: existing.svenska_spel_team_id,
        apiFootballTeamId: existing.api_football_team_id,
        confidence: existing.confidence as MatchConfidence,
        matchMethod: existing.match_method as MatchMethod,
        similarity: existing.similarity ? Number(existing.similarity) : undefined,
        betradarId: existing.betradar_id || undefined,
        kambiId: existing.kambi_id || undefined,
      }
    }

    // Try to match
    const mapping = await this.matchTeam(teamName, options)

    if (mapping) {
      // Store the mapping
      await this.storeMapping(svenskaSpelTeamId, mapping, options.betradarId, options.kambiId)
      return {
        ...mapping,
        svenskaSpelTeamId,
      }
    }

    // Store as unmapped for review
    await this.storeUnmapped(svenskaSpelTeamId, teamName, options)

    return null
  }

  /**
   * Match a team by name and context
   */
  async matchTeam(
    teamName: string,
    options: {
      leagueId?: number
      leagueName?: string
      countryName?: string
      betradarId?: string
      kambiId?: string
    } = {}
  ): Promise<TeamMapping | null> {
    // Strategy 1: Match by external ID (BetRadar/Kambi)
    if (options.betradarId || options.kambiId) {
      const idMatch = await this.matchByExternalId(options.betradarId, options.kambiId)
      if (idMatch) {
        return idMatch
      }
    }

    // Strategy 2: Match within league context (most efficient)
    if (options.leagueId || options.leagueName) {
      const leagueMatch = await this.matchWithinLeague(
        teamName,
        options.leagueId,
        options.leagueName,
        options.countryName
      )
      if (leagueMatch) {
        return leagueMatch
      }
    }

    // Strategy 3: Global search (fallback, more expensive)
    const globalMatch = await this.matchGlobal(teamName)
    if (globalMatch) {
      return globalMatch
    }

    return null
  }

  /**
   * Match by external ID (BetRadar/Kambi)
   */
  private async matchByExternalId(
    _betradarId?: string,
    _kambiId?: string
  ): Promise<TeamMapping | null> {
    // Note: API-Football doesn't directly support BetRadar/Kambi ID lookup
    // We would need to maintain our own mapping table or use search
    // For now, we'll skip this and rely on fuzzy matching
    // TODO: Build external ID mapping table from historical data

    return null
  }

  /**
   * Match within a specific league (most efficient)
   */
  private async matchWithinLeague(
    teamName: string,
    leagueId?: number,
    leagueName?: string,
    countryName?: string
  ): Promise<TeamMapping | null> {
    // Get API-Football league ID
    let apiLeagueId: number | null = null

    if (leagueId) {
      const leagueMapping = await this.leagueMatcher.matchLeagueById(
        leagueId,
        leagueName || '',
        countryName
      )
      if (leagueMapping) {
        apiLeagueId = leagueMapping.apiFootballLeagueId
      }
    } else if (leagueName) {
      const leagueMapping = await this.leagueMatcher.matchLeague(leagueName, countryName)
      if (leagueMapping) {
        apiLeagueId = leagueMapping.apiFootballLeagueId
      }
    }

    if (!apiLeagueId) {
      console.warn(`[TeamMatcher] Could not find league: ${leagueName || leagueId}`)
      return null
    }

    // Get all teams in the league (cached)
    const leagueTeams = await this.getLeagueTeams(apiLeagueId)

    // Find best match
    return this.findBestMatch(teamName, leagueTeams)
  }

  /**
   * Global team search (fallback)
   */
  private async matchGlobal(teamName: string): Promise<TeamMapping | null> {
    try {
      // Use API search endpoint
      const response = await this.client.get<ApiFootballTeamResponse[]>(
        '/teams',
        { search: teamName },
        { cacheTtlSeconds: LEAGUE_ROSTER_CACHE_TTL }
      )

      if (response.response.length === 0) {
        return null
      }

      return this.findBestMatch(teamName, response.response)
    } catch (error) {
      console.warn(`[TeamMatcher] Global search failed for "${teamName}":`, error)
      return null
    }
  }

  /**
   * Find best match from a list of teams
   */
  private findBestMatch(teamName: string, teams: ApiFootballTeamResponse[]): TeamMapping | null {
    if (teams.length === 0) return null

    // Check for exact/alias match first
    const exactMatch = teams.find(t => matchesAlias(teamName, t.team.name))
    if (exactMatch) {
      return {
        svenskaSpelTeamId: 0,
        apiFootballTeamId: exactMatch.team.id,
        confidence: 'high',
        matchMethod: 'exact',
        similarity: 100,
      }
    }

    // Score all candidates
    const scored = teams.map(t => ({
      team: t,
      similarity: calculateSimilarity(teamName, t.team.name),
    }))

    // Sort by similarity (descending)
    scored.sort((a, b) => b.similarity - a.similarity)

    // Take best match if similarity >= 80%
    const best = scored[0]
    if (best && best.similarity >= 80) {
      return {
        svenskaSpelTeamId: 0,
        apiFootballTeamId: best.team.team.id,
        confidence: getConfidenceFromSimilarity(best.similarity),
        matchMethod: 'fuzzy_match',
        similarity: best.similarity,
      }
    }

    return null
  }

  /**
   * Store a team mapping
   */
  private async storeMapping(
    svenskaSpelTeamId: number,
    mapping: TeamMapping,
    betradarId?: string,
    kambiId?: string
  ): Promise<void> {
    await prisma.team_mappings.upsert({
      where: { svenska_spel_team_id: svenskaSpelTeamId },
      create: {
        svenska_spel_team_id: svenskaSpelTeamId,
        api_football_team_id: mapping.apiFootballTeamId,
        confidence: mapping.confidence,
        match_method: mapping.matchMethod,
        similarity: mapping.similarity,
        betradar_id: betradarId,
        kambi_id: kambiId,
      },
      update: {
        api_football_team_id: mapping.apiFootballTeamId,
        confidence: mapping.confidence,
        match_method: mapping.matchMethod,
        similarity: mapping.similarity,
        betradar_id: betradarId,
        kambi_id: kambiId,
      },
    })

    console.log(
      `[TeamMatcher] Mapped team ${svenskaSpelTeamId} → ${mapping.apiFootballTeamId} (${mapping.confidence}, ${mapping.matchMethod})`
    )
  }

  /**
   * Store an unmapped team for review
   */
  private async storeUnmapped(
    svenskaSpelTeamId: number,
    teamName: string,
    options: {
      leagueName?: string
      countryName?: string
      betradarId?: string
      kambiId?: string
    }
  ): Promise<void> {
    // Get best candidates for manual review
    const candidates = await this.getBestCandidates(
      teamName,
      options.leagueName,
      options.countryName
    )

    await prisma.unmapped_teams.upsert({
      where: {
        id: await this.getUnmappedId(svenskaSpelTeamId),
      },
      create: {
        svenska_spel_team_id: svenskaSpelTeamId,
        team_name: teamName,
        league_name: options.leagueName,
        country_name: options.countryName,
        betradar_id: options.betradarId,
        kambi_id: options.kambiId,
        best_candidates: candidates as unknown as Prisma.InputJsonValue,
        retry_count: 0,
      },
      update: {
        team_name: teamName,
        league_name: options.leagueName,
        country_name: options.countryName,
        betradar_id: options.betradarId,
        kambi_id: options.kambiId,
        best_candidates: candidates as unknown as Prisma.InputJsonValue,
        retry_count: { increment: 1 },
        attempted_at: new Date(),
      },
    })

    console.warn(`[TeamMatcher] Could not match team "${teamName}" - stored for review`)
  }

  /**
   * Helper to get unmapped team ID or return 0 for new insert
   */
  private async getUnmappedId(svenskaSpelTeamId: number): Promise<number> {
    const existing = await prisma.unmapped_teams.findFirst({
      where: { svenska_spel_team_id: svenskaSpelTeamId, resolved: false },
      select: { id: true },
    })
    return existing?.id || 0
  }

  /**
   * Get best candidates for manual mapping
   */
  async getBestCandidates(
    teamName: string,
    leagueName?: string,
    countryName?: string,
    limit = 3
  ): Promise<MatchCandidate[]> {
    let teams: ApiFootballTeamResponse[] = []

    // Try to get teams from league context first
    if (leagueName) {
      const leagueMapping = await this.leagueMatcher.matchLeague(leagueName, countryName)
      if (leagueMapping) {
        teams = await this.getLeagueTeams(leagueMapping.apiFootballLeagueId)
      }
    }

    // If no league context, do a global search
    if (teams.length === 0) {
      try {
        const response = await this.client.get<ApiFootballTeamResponse[]>(
          '/teams',
          { search: teamName.split(' ')[0]! }, // Search by first word
          { cacheTtlSeconds: LEAGUE_ROSTER_CACHE_TTL }
        )
        teams = response.response
      } catch {
        return []
      }
    }

    // Score and return top candidates
    const scored = teams.map(t => ({
      id: t.team.id,
      name: t.team.name,
      similarity: calculateSimilarity(teamName, t.team.name),
      country: t.team.country,
    }))

    return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
  }

  /**
   * Manually set a team mapping
   */
  async setManualMapping(
    svenskaSpelTeamId: number,
    apiFootballTeamId: number,
    verifiedBy?: string
  ): Promise<void> {
    await prisma.team_mappings.upsert({
      where: { svenska_spel_team_id: svenskaSpelTeamId },
      create: {
        svenska_spel_team_id: svenskaSpelTeamId,
        api_football_team_id: apiFootballTeamId,
        confidence: 'high',
        match_method: 'manual',
        verified: true,
        verified_by: verifiedBy,
        verified_at: new Date(),
      },
      update: {
        api_football_team_id: apiFootballTeamId,
        confidence: 'high',
        match_method: 'manual',
        verified: true,
        verified_by: verifiedBy,
        verified_at: new Date(),
      },
    })

    // Mark as resolved in unmapped_teams
    await prisma.unmapped_teams.updateMany({
      where: { svenska_spel_team_id: svenskaSpelTeamId, resolved: false },
      data: {
        resolved: true,
        resolved_at: new Date(),
        resolved_by: verifiedBy,
      },
    })
  }

  /**
   * Get all unmapped teams for review
   */
  async getUnmappedTeams(): Promise<UnmappedTeam[]> {
    const unmapped = await prisma.unmapped_teams.findMany({
      where: { resolved: false },
      orderBy: { attempted_at: 'desc' },
    })

    return unmapped.map(u => ({
      svenskaSpelTeamId: u.svenska_spel_team_id,
      teamName: u.team_name,
      leagueName: u.league_name || undefined,
      countryName: u.country_name || undefined,
      betradarId: u.betradar_id || undefined,
      kambiId: u.kambi_id || undefined,
      bestCandidates: (u.best_candidates as unknown as MatchCandidate[]) || [],
    }))
  }

  /**
   * Get mapping statistics
   */
  async getMappingStats(): Promise<{
    totalTeams: number
    mappedHigh: number
    mappedMedium: number
    mappedLow: number
    unmapped: number
    verified: number
  }> {
    const [totalTeams, mappings, unmapped] = await Promise.all([
      prisma.teams.count(),
      prisma.team_mappings.groupBy({
        by: ['confidence', 'verified'],
        _count: true,
      }),
      prisma.unmapped_teams.count({ where: { resolved: false } }),
    ])

    const stats = {
      totalTeams,
      mappedHigh: 0,
      mappedMedium: 0,
      mappedLow: 0,
      unmapped,
      verified: 0,
    }

    for (const m of mappings) {
      if (m.verified) stats.verified += m._count
      if (m.confidence === 'high') stats.mappedHigh += m._count
      else if (m.confidence === 'medium') stats.mappedMedium += m._count
      else if (m.confidence === 'low') stats.mappedLow += m._count
    }

    return stats
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let matcherInstance: TeamMatcher | null = null

export function getTeamMatcher(): TeamMatcher {
  if (!matcherInstance) {
    matcherInstance = new TeamMatcher()
  }
  return matcherInstance
}
