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
// Keys are descriptive, values include BOTH Svenska Spel names AND API-Football names
const LEAGUE_NAME_ALIASES: Record<string, string[]> = {
  // Top European leagues
  'Premier League': ['Premier League', 'English Premier League', 'EPL'],
  'La Liga': ['La Liga', 'LaLiga', 'Spanish La Liga', 'Primera Division'],
  Bundesliga: ['Bundesliga', 'German Bundesliga', '1. Bundesliga'],
  'Serie A Italy': ['Serie A', 'Italian Serie A', 'Serie A TIM'],
  'Ligue 1': ['Ligue 1', 'French Ligue 1', 'Ligue 1 Uber Eats'],

  // English lower tiers (API-Football uses "Championship", "League One", "League Two")
  Championship: ['Championship', 'EFL Championship', 'English Championship'],
  'League One': ['League One', 'EFL League One', 'English League One'],
  'League Two': ['League Two', 'EFL League Two', 'English League Two'],

  // Scandinavian leagues
  Allsvenskan: ['Allsvenskan', 'Swedish Allsvenskan'],
  Superettan: ['Superettan', 'Swedish Superettan'],
  Eliteserien: ['Eliteserien', 'Norwegian Eliteserien', 'Tippeligaen'],
  Superligaen: ['Superligaen', 'Danish Superliga', 'Danish Superligaen'],

  // Other European leagues
  Eredivisie: ['Eredivisie', 'Dutch Eredivisie'],
  'Primeira Liga': ['Primeira Liga', 'Liga Portugal', 'Portuguese Liga'],
  'Scottish Premiership': ['Scottish Premiership', 'SPFL Premiership', 'Premiership'],

  // South American leagues
  'Liga Profesional Argentina': [
    'Liga Profesional',
    'Liga Profesional Argentina',
    'Argentine Primera Division',
    'Superliga Argentina',
    'Primera División Argentina',
    'Primera Division Argentina',
  ],
  'Serie A Brazil': ['Brasileirao', 'Brasileirão', 'Serie A Brazil', 'Campeonato Brasileiro'],

  // Central America
  'Primera Division Costa Rica': [
    'Primera Division',
    'Primera Division, Clausura',
    'Primera Division, Apertura',
    'Liga FPD',
    'Primera Division Costa Rica',
  ],

  // European competitions (API-Football uses "UEFA Europa League", etc.)
  'Champions League': ['Champions League', 'UEFA Champions League', 'UCL'],
  'Europa League': ['Europa League', 'UEFA Europa League', 'UEL'],
  'Conference League': ['Conference League', 'UEFA Europa Conference League', 'UECL'],

  // International
  Friendlies: [
    'Friendlies',
    'International Friendlies',
    'Internationella vänskapsmatcher',
    'Friendly',
    'Club Friendly',
    'Friendly International',
  ],

  // World Cup qualifiers
  'World Cup Qualifiers': [
    'World Cup Qualifiers',
    'World Cup - Qualification',
    'WC Qualification',
    'VM-kval',
  ],
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
    if (this.leagueCache && this.leagueCache.length > 0) {
      return this.leagueCache
    }

    try {
      console.log('[LeagueMatcher] Fetching leagues from API-Football...')
      // Bypass circuit breaker for leagues - this is critical initialization data
      // and should always attempt to fetch if not cached
      const response = await this.client.get<ApiFootballLeagueResponse[]>('/leagues', undefined, {
        cacheTtlSeconds: CACHE_TTL_SECONDS,
        skipCircuitBreaker: true, // Don't let team search failures block leagues fetch
      })

      const leagues = response.response ?? []
      console.log(`[LeagueMatcher] Received ${leagues.length} leagues from API-Football`)

      // Only cache if we got actual data
      if (leagues.length > 0) {
        this.leagueCache = leagues
      } else {
        console.warn('[LeagueMatcher] API returned empty leagues list - check API key and quota')
        // Check if there are errors in the response
        if (response.errors && Object.keys(response.errors).length > 0) {
          console.error('[LeagueMatcher] API errors:', JSON.stringify(response.errors))
        }
      }

      return leagues
    } catch (error) {
      console.error('[LeagueMatcher] Failed to fetch leagues:', error)
      return []
    }
  }

  /**
   * Clear the in-memory league cache (useful for testing or after cache invalidation)
   */
  clearCache(): void {
    this.leagueCache = null
    console.log('[LeagueMatcher] In-memory cache cleared')
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

    // Debug: Check if we have leagues to search
    if (allLeagues.length === 0) {
      console.warn(
        `[LeagueMatcher] No leagues available from API-Football for matching "${leagueName}"`
      )
      return null
    }

    // Strategy 1: Exact match (with aliases)
    const exactMatch = this.findExactMatch(leagueName, countryName, allLeagues)
    if (exactMatch) {
      return exactMatch
    }

    // Strategy 2: Fuzzy match with country context
    const fuzzyMatch = this.findFuzzyMatch(leagueName, countryName, allLeagues)
    if (fuzzyMatch) {
      return fuzzyMatch
    }

    // Strategy 3: Fuzzy match WITHOUT country filter (fallback for ambiguous leagues)
    // This catches cases like "Championship" where we don't know if it's England
    if (countryName) {
      const fuzzyMatchNoCountry = this.findFuzzyMatch(leagueName, undefined, allLeagues)
      if (
        fuzzyMatchNoCountry &&
        fuzzyMatchNoCountry.similarity &&
        fuzzyMatchNoCountry.similarity >= 85
      ) {
        // Only accept high-confidence matches when ignoring country
        return fuzzyMatchNoCountry
      }
    }

    // Log top candidates when no match found (always, not just in dev)
    const topCandidates = allLeagues
      .map(l => ({
        name: l.league.name,
        country: l.country.name,
        id: l.league.id,
        similarity: calculateSimilarity(leagueName, l.league.name),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)

    console.warn(
      `[LeagueMatcher] No match for "${leagueName}" (country: ${countryName || 'none'}). ` +
        `Top candidates: ${topCandidates.map(c => `${c.name}=${c.similarity}%`).join(', ')}`
    )

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
    // The aliases array contains both Svenska Spel names AND API-Football names
    // We need to find if input matches any alias, then search for ANY alias in API-Football
    for (const [_canonical, aliases] of Object.entries(LEAGUE_NAME_ALIASES)) {
      const normalizedAliases = aliases.map(normalizeString)
      if (normalizedAliases.includes(normalizedName)) {
        // Found an alias match - now search for ANY of the aliases in API-Football
        // (API-Football might use a different name than our canonical key)
        const league = allLeagues.find(l => {
          const apiLeagueName = normalizeString(l.league.name)
          const nameMatch = normalizedAliases.includes(apiLeagueName)
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
    // Use multiple matching strategies and take the best score
    const scored: Array<{ league: ApiFootballLeagueResponse; similarity: number }> = candidates.map(
      league => {
        const levenshteinScore = calculateSimilarity(leagueName, league.league.name)

        // Boost score if key words match (e.g., "Championship" in both)
        const inputWords = normalizeString(leagueName)
          .split(' ')
          .filter(w => w.length > 3)
        const leagueWords = normalizeString(league.league.name)
          .split(' ')
          .filter(w => w.length > 3)
        const matchingWords = inputWords.filter(w => leagueWords.includes(w))
        const wordMatchBoost = matchingWords.length > 0 ? 15 : 0

        // Boost if the input is a substring or vice versa
        const normalInput = normalizeString(leagueName)
        const normalLeague = normalizeString(league.league.name)
        const substringBoost =
          normalInput.includes(normalLeague) || normalLeague.includes(normalInput) ? 10 : 0

        return {
          league,
          similarity: Math.min(100, levenshteinScore + wordMatchBoost + substringBoost),
        }
      }
    )

    // Sort by similarity (descending)
    scored.sort((a, b) => b.similarity - a.similarity)

    // Take best match if similarity >= 70% (lowered threshold due to boosts)
    const best = scored[0]
    if (best && best.similarity >= 70) {
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
