/**
 * Data Provider Types
 *
 * Abstract interface for match data providers, enabling swappable
 * implementations (API-Football, Web Scraping, Cache).
 */

// ============================================================================
// Provider Interface
// ============================================================================

export type DataSource = 'api-football' | 'web-scraping' | 'cache'

/**
 * Abstract interface for match data providers
 * Implementations: ApiFootballProvider, WebScraperProvider, CachedDataProvider
 */
export interface MatchDataProvider {
  /** Provider name for logging */
  readonly name: string

  /** Provider source identifier */
  readonly source: DataSource

  /** Priority order (lower = tried first) */
  readonly priority: number

  /** Fetch fixture statistics */
  getStatistics(matchId: number): Promise<MatchStatistics | null>

  /** Fetch current injuries for a team */
  getInjuries(teamId: number): Promise<PlayerInjury[]>

  /** Fetch team statistics for current season */
  getTeamStats(teamId: number, season?: number): Promise<TeamStatistics | null>

  /** Fetch head-to-head history between two teams */
  getHeadToHead(team1Id: number, team2Id: number): Promise<HeadToHeadData | null>

  /** Check if provider is healthy and responsive */
  isHealthy(): Promise<boolean>
}

// ============================================================================
// Data Structures
// ============================================================================

export interface MatchStatistics {
  matchId: number
  homeTeam: TeamMatchStats
  awayTeam: TeamMatchStats
  source: DataSource
  fetchedAt: Date
}

export interface TeamMatchStats {
  teamId: number
  teamName: string
  shots: { total: number; onTarget: number }
  possession: number
  passes: { total: number; accurate: number; percentage: number }
  fouls: number
  corners: number
  offsides: number
  yellowCards: number
  redCards: number
}

export interface PlayerInjury {
  playerId?: number
  playerName: string
  teamId: number
  teamName: string
  reason: string
  type: string // 'Missing Fixture', 'Questionable', etc.
  severity: 'minor' | 'moderate' | 'severe'
  expectedReturn?: Date
  source: DataSource
}

export interface TeamStatistics {
  teamId: number
  teamName: string
  season: number
  form: string // "WWDLL" format
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  homeRecord: {
    played: number
    wins: number
    draws: number
    losses: number
    goalsFor: number
    goalsAgainst: number
  }
  awayRecord: {
    played: number
    wins: number
    draws: number
    losses: number
    goalsFor: number
    goalsAgainst: number
  }
  cleanSheets: number
  failedToScore: number
  source: DataSource
}

export interface HeadToHeadData {
  team1Id: number
  team2Id: number
  team1Name: string
  team2Name: string
  lastMatches: HistoricalMatch[]
  team1Wins: number
  draws: number
  team2Wins: number
  totalMatches: number
  source: DataSource
}

export interface HistoricalMatch {
  date: Date
  homeTeamId: number
  awayTeamId: number
  homeTeamName: string
  awayTeamName: string
  scoreHome: number
  scoreAway: number
  venue?: string
  league?: string
}

// ============================================================================
// Health & Status
// ============================================================================

export interface ProviderHealthReport {
  name: string
  source: DataSource
  priority: number
  healthy: boolean
  circuitBreakerOpen: boolean
  failureCount: number
  lastChecked: Date
}

export interface ProviderStats {
  requestCount: number
  successCount: number
  failureCount: number
  cacheHitRate: number
  avgResponseTimeMs: number
}
