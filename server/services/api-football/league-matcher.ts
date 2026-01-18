/**
 * League Matching Service
 *
 * Automatically matches Svenska Spel leagues to API-Football leagues
 * using exact name matching, fuzzy matching, and manual overrides.
 */

import { prisma } from '~/server/utils/prisma'
import { getApiFootballClient } from './client'
import type {
  ApiFootballLeagueResponse,
  LeagueMapping,
  MatchCandidate,
  MatchConfidence,
  MatchMethod,
} from './types'

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days - leagues don't change often

// Common league name mappings for Swedish/English variations
const LEAGUE_NAME_ALIASES: Record<string, string[]> = {
  'Premier League': ['Premier League', 'English Premier League', 'EPL'],
  'La Liga': ['La Liga', 'LaLiga', 'Primera Division', 'Spanish La Liga'],
  Bundesliga: ['Bundesliga', 'German Bundesliga', '1. Bundesliga'],
  'Serie A': ['Serie A', 'Italian Serie A', 'Serie A TIM'],
  'Ligue 1': ['Ligue 1', 'French Ligue 1', 'Ligue 1 Uber Eats'],
  Allsvenskan: ['Allsvenskan', 'Swedish Allsvenskan'],
  Superettan: ['Superettan', 'Swedish Superettan'],
  Eredivisie: ['Eredivisie', 'Dutch Eredivisie'],
  'Primeira Liga': ['Primeira Liga', 'Liga Portugal', 'Portuguese Liga'],
  'Scottish Premiership': ['Scottish Premiership', 'SPFL Premiership'],
  'Champions League': ['Champions League', 'UEFA Champions League', 'UCL'],
  'Europa League': ['Europa League', 'UEFA Europa League', 'UEL'],
  'Conference League': ['Conference League', 'UEFA Europa Conference League', 'UECL'],
}

// Country name mappings
const COUNTRY_NAME_MAPPINGS: Record<string, string> = {
  England: 'England',
  Spain: 'Spain',
  Germany: 'Germany',
  Italy: 'Italy',
  France: 'France',
  Sweden: 'Sweden',
  Netherlands: 'Netherlands',
  Portugal: 'Portugal',
  Scotland: 'Scotland',
  World: 'World', // For international competitions
  Europa: 'World', // UEFA competitions
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize a string for comparison (lowercase, remove accents, trim)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

/**
 * Calculate Levenshtein distance between two strings
 */
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
        currentRow[j] = Math.min(
          prevRow[j - 1]! + 1, // substitution
          currentRow[j - 1]! + 1, // insertion
          prevRow[j]! + 1 // deletion
        )
      }
    }
  }

  return matrix[b.length]![a.length]!
}

/**
 * Calculate similarity score (0-100) between two strings
 */
function calculateSimilarity(a: string, b: string): number {
  const normalA = normalizeString(a)
  const normalB = normalizeString(b)

  if (normalA === normalB) return 100

  const distance = levenshteinDistance(normalA, normalB)
  const maxLength = Math.max(normalA.length, normalB.length)

  if (maxLength === 0) return 100

  return Math.round((1 - distance / maxLength) * 100)
}

/**
 * Determine confidence level from similarity score
 */
function getConfidenceFromSimilarity(similarity: number): MatchConfidence {
  if (similarity >= 95) return 'high'
  if (similarity >= 80) return 'medium'
  return 'low'
}

// ============================================================================
// League Matcher Service
// ============================================================================

export class LeagueMatcher {
  private client = getApiFootballClient()
  private leagueCache: ApiFootballLeagueResponse[] | null = null

  /**
   * Get all leagues from API-Football (cached)
   */
  async getAllLeagues(): Promise<ApiFootballLeagueResponse[]> {
    if (this.leagueCache) {
      return this.leagueCache
    }

    const response = await this.client.get<ApiFootballLeagueResponse[]>('/leagues', undefined, {
      cacheTtlSeconds: CACHE_TTL_SECONDS,
    })

    this.leagueCache = response.response
    return this.leagueCache
  }

  /**
   * Match a Svenska Spel league to an API-Football league
   */
  async matchLeague(leagueName: string, countryName?: string): Promise<LeagueMapping | null> {
    // Check for existing mapping in database
    const existingMapping = await this.getExistingMappingByName(leagueName)
    if (existingMapping) {
      return existingMapping
    }

    const allLeagues = await this.getAllLeagues()

    // Strategy 1: Exact match (with aliases)
    const exactMatch = this.findExactMatch(leagueName, countryName, allLeagues)
    if (exactMatch) {
      return exactMatch
    }

    // Strategy 2: Fuzzy match
    const fuzzyMatch = this.findFuzzyMatch(leagueName, countryName, allLeagues)
    if (fuzzyMatch) {
      return fuzzyMatch
    }

    return null
  }

  /**
   * Match a league by its Svenska Spel ID
   */
  async matchLeagueById(
    svenskaSpelLeagueId: number,
    leagueName: string,
    countryName?: string
  ): Promise<LeagueMapping | null> {
    // Check for existing mapping
    const existing = await prisma.league_mappings.findUnique({
      where: { svenska_spel_league_id: svenskaSpelLeagueId },
    })

    if (existing) {
      return {
        svenskaSpelLeagueId: existing.svenska_spel_league_id,
        apiFootballLeagueId: existing.api_football_league_id,
        confidence: existing.confidence as MatchConfidence,
        matchMethod: existing.match_method as MatchMethod,
        similarity: existing.similarity ? Number(existing.similarity) : undefined,
      }
    }

    // Try to match
    const mapping = await this.matchLeague(leagueName, countryName)

    if (mapping) {
      // Store the mapping
      await this.storeMapping(svenskaSpelLeagueId, mapping)
      return {
        ...mapping,
        svenskaSpelLeagueId,
      }
    }

    return null
  }

  /**
   * Find exact match (including aliases)
   */
  private findExactMatch(
    leagueName: string,
    countryName: string | undefined,
    allLeagues: ApiFootballLeagueResponse[]
  ): LeagueMapping | null {
    const normalizedName = normalizeString(leagueName)
    const normalizedCountry = countryName ? normalizeString(countryName) : undefined

    // Check against aliases first
    for (const [canonical, aliases] of Object.entries(LEAGUE_NAME_ALIASES)) {
      const normalizedAliases = aliases.map(normalizeString)
      if (normalizedAliases.includes(normalizedName)) {
        // Found an alias match, look for the canonical league
        const league = allLeagues.find(l => {
          const nameMatch = normalizeString(l.league.name) === normalizeString(canonical)
          if (!nameMatch) return false

          // If country specified, must match
          if (normalizedCountry) {
            const mappedCountry = COUNTRY_NAME_MAPPINGS[countryName!] || countryName
            return normalizeString(l.country.name) === normalizeString(mappedCountry || '')
          }
          return true
        })

        if (league) {
          return {
            svenskaSpelLeagueId: 0, // Will be set by caller
            apiFootballLeagueId: league.league.id,
            confidence: 'high',
            matchMethod: 'exact',
            similarity: 100,
          }
        }
      }
    }

    // Direct name match
    const directMatch = allLeagues.find(l => {
      const nameMatch = normalizeString(l.league.name) === normalizedName
      if (!nameMatch) return false

      if (normalizedCountry) {
        const mappedCountry = COUNTRY_NAME_MAPPINGS[countryName!] || countryName
        return normalizeString(l.country.name) === normalizeString(mappedCountry || '')
      }
      return true
    })

    if (directMatch) {
      return {
        svenskaSpelLeagueId: 0,
        apiFootballLeagueId: directMatch.league.id,
        confidence: 'high',
        matchMethod: 'exact',
        similarity: 100,
      }
    }

    return null
  }

  /**
   * Find fuzzy match
   */
  private findFuzzyMatch(
    leagueName: string,
    countryName: string | undefined,
    allLeagues: ApiFootballLeagueResponse[]
  ): LeagueMapping | null {
    const normalizedCountry = countryName ? normalizeString(countryName) : undefined
    const mappedCountry = countryName
      ? COUNTRY_NAME_MAPPINGS[countryName] || countryName
      : undefined

    // Filter by country if specified
    let candidates = allLeagues
    if (normalizedCountry && mappedCountry) {
      candidates = allLeagues.filter(
        l => normalizeString(l.country.name) === normalizeString(mappedCountry)
      )
    }

    // Calculate similarity for each candidate
    const scored: Array<{ league: ApiFootballLeagueResponse; similarity: number }> = candidates.map(
      league => ({
        league,
        similarity: calculateSimilarity(leagueName, league.league.name),
      })
    )

    // Sort by similarity (descending)
    scored.sort((a, b) => b.similarity - a.similarity)

    // Take best match if similarity >= 80%
    const best = scored[0]
    if (best && best.similarity >= 80) {
      return {
        svenskaSpelLeagueId: 0,
        apiFootballLeagueId: best.league.league.id,
        confidence: getConfidenceFromSimilarity(best.similarity),
        matchMethod: 'fuzzy_match',
        similarity: best.similarity,
      }
    }

    return null
  }

  /**
   * Get existing mapping by league name
   */
  private async getExistingMappingByName(leagueName: string): Promise<LeagueMapping | null> {
    // Look up league by name in our database
    const league = await prisma.leagues.findFirst({
      where: { name: leagueName },
      include: { league_mapping: true },
    })

    if (league?.league_mapping) {
      return {
        svenskaSpelLeagueId: league.id,
        apiFootballLeagueId: league.league_mapping.api_football_league_id,
        confidence: league.league_mapping.confidence as MatchConfidence,
        matchMethod: league.league_mapping.match_method as MatchMethod,
        similarity: league.league_mapping.similarity
          ? Number(league.league_mapping.similarity)
          : undefined,
      }
    }

    return null
  }

  /**
   * Store a league mapping
   */
  private async storeMapping(svenskaSpelLeagueId: number, mapping: LeagueMapping): Promise<void> {
    await prisma.league_mappings.upsert({
      where: { svenska_spel_league_id: svenskaSpelLeagueId },
      create: {
        svenska_spel_league_id: svenskaSpelLeagueId,
        api_football_league_id: mapping.apiFootballLeagueId,
        confidence: mapping.confidence,
        match_method: mapping.matchMethod,
        similarity: mapping.similarity,
      },
      update: {
        api_football_league_id: mapping.apiFootballLeagueId,
        confidence: mapping.confidence,
        match_method: mapping.matchMethod,
        similarity: mapping.similarity,
      },
    })
  }

  /**
   * Get best candidates for manual mapping
   */
  async getBestCandidates(
    leagueName: string,
    countryName?: string,
    limit = 5
  ): Promise<MatchCandidate[]> {
    const allLeagues = await this.getAllLeagues()
    const normalizedCountry = countryName ? normalizeString(countryName) : undefined
    const mappedCountry = countryName
      ? COUNTRY_NAME_MAPPINGS[countryName] || countryName
      : undefined

    // Filter by country if specified
    let candidates = allLeagues
    if (normalizedCountry && mappedCountry) {
      candidates = allLeagues.filter(
        l => normalizeString(l.country.name) === normalizeString(mappedCountry)
      )
    }

    // Score all candidates
    const scored = candidates.map(league => ({
      id: league.league.id,
      name: league.league.name,
      similarity: calculateSimilarity(leagueName, league.league.name),
      country: league.country.name,
    }))

    // Sort and return top matches
    return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
  }

  /**
   * Manually set a league mapping
   */
  async setManualMapping(
    svenskaSpelLeagueId: number,
    apiFootballLeagueId: number,
    verifiedBy?: string
  ): Promise<void> {
    await prisma.league_mappings.upsert({
      where: { svenska_spel_league_id: svenskaSpelLeagueId },
      create: {
        svenska_spel_league_id: svenskaSpelLeagueId,
        api_football_league_id: apiFootballLeagueId,
        confidence: 'high',
        match_method: 'manual',
        verified: true,
        verified_by: verifiedBy,
        verified_at: new Date(),
      },
      update: {
        api_football_league_id: apiFootballLeagueId,
        confidence: 'high',
        match_method: 'manual',
        verified: true,
        verified_by: verifiedBy,
        verified_at: new Date(),
      },
    })
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let matcherInstance: LeagueMatcher | null = null

export function getLeagueMatcher(): LeagueMatcher {
  if (!matcherInstance) {
    matcherInstance = new LeagueMatcher()
  }
  return matcherInstance
}
