/**
 * API-Football Type Definitions
 *
 * Types for API-Football responses and internal data structures.
 */

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiFootballTeam {
  id: number
  name: string
  code: string | null
  country: string
  founded: number | null
  national: boolean
  logo: string
}

export interface ApiFootballVenue {
  id: number
  name: string
  address: string
  city: string
  capacity: number
  surface: string
  image: string
}

export interface ApiFootballLeague {
  id: number
  name: string
  type: 'League' | 'Cup'
  logo: string
}

export interface ApiFootballCountry {
  name: string
  code: string | null
  flag: string | null
}

export interface ApiFootballSeason {
  year: number
  start: string
  end: string
  current: boolean
  coverage: {
    fixtures: {
      events: boolean
      lineups: boolean
      statistics_fixtures: boolean
      statistics_players: boolean
    }
    standings: boolean
    players: boolean
    top_scorers: boolean
    top_assists: boolean
    top_cards: boolean
    injuries: boolean
    predictions: boolean
    odds: boolean
  }
}

export interface ApiFootballLeagueResponse {
  league: ApiFootballLeague
  country: ApiFootballCountry
  seasons: ApiFootballSeason[]
}

export interface ApiFootballTeamResponse {
  team: ApiFootballTeam
  venue: ApiFootballVenue
}

export interface ApiFootballFixture {
  id: number
  referee: string | null
  timezone: string
  date: string
  timestamp: number
  periods: {
    first: number | null
    second: number | null
  }
  venue: {
    id: number | null
    name: string
    city: string
  }
  status: {
    long: string
    short: string // 'FT', 'NS', 'HT', '1H', '2H', etc.
    elapsed: number | null
  }
}

export interface ApiFootballFixtureTeams {
  home: {
    id: number
    name: string
    logo: string
    winner: boolean | null
  }
  away: {
    id: number
    name: string
    logo: string
    winner: boolean | null
  }
}

export interface ApiFootballFixtureGoals {
  home: number | null
  away: number | null
}

export interface ApiFootballFixtureScore {
  halftime: ApiFootballFixtureGoals
  fulltime: ApiFootballFixtureGoals
  extratime: ApiFootballFixtureGoals
  penalty: ApiFootballFixtureGoals
}

export interface ApiFootballFixtureResponse {
  fixture: ApiFootballFixture
  league: {
    id: number
    name: string
    country: string
    logo: string
    flag: string | null
    season: number
    round: string
  }
  teams: ApiFootballFixtureTeams
  goals: ApiFootballFixtureGoals
  score: ApiFootballFixtureScore
}

export interface ApiFootballStatistic {
  type: string
  value: number | string | null
}

export interface ApiFootballTeamStatistics {
  team: {
    id: number
    name: string
    logo: string
  }
  statistics: ApiFootballStatistic[]
}

export interface ApiFootballSeasonStatisticsResponse {
  league: { id: number; name: string; country: string; logo: string; flag: string; season: number }
  team: { id: number; name: string; logo: string }
  form: string
  fixtures: {
    played: { home: number; away: number; total: number }
    wins: { home: number; away: number; total: number }
    draws: { home: number; away: number; total: number }
    loses: { home: number; away: number; total: number }
  }
  goals: {
    for: {
      total: { home: number; away: number; total: number }
      average: { home: string; away: string; total: string }
    }
    against: {
      total: { home: number; away: number; total: number }
      average: { home: string; away: string; total: string }
    }
  }
  biggest: {
    streak: { wins: number; draws: number; loses: number }
    wins: { home: string | null; away: string | null }
    loses: { home: string | null; away: string | null }
    goals: { for: { home: number; away: number }; against: { home: number; away: number } }
  }
  clean_sheet: { home: number; away: number; total: number }
  failed_to_score: { home: number; away: number; total: number }
  penalty: {
    scored: { total: number; percentage: string }
    missed: { total: number; percentage: string }
  }
}

export interface ApiFootballInjury {
  player: {
    id: number
    name: string
    photo: string
    type: string // 'Missing Fixture', 'Questionable', etc.
    reason: string // 'Injury', 'Suspended', etc.
  }
  team: {
    id: number
    name: string
    logo: string
  }
  fixture: {
    id: number
    timezone: string
    date: string
    timestamp: number
  }
  league: {
    id: number
    season: number
    name: string
    country: string
    logo: string
    flag: string | null
  }
}

export interface ApiFootballLineup {
  team: {
    id: number
    name: string
    logo: string
    colors: {
      player: { primary: string; number: string; border: string }
      goalkeeper: { primary: string; number: string; border: string }
    } | null
  }
  coach: {
    id: number
    name: string
    photo: string
  }
  formation: string
  startXI: Array<{
    player: {
      id: number
      name: string
      number: number
      pos: string
      grid: string | null
    }
  }>
  substitutes: Array<{
    player: {
      id: number
      name: string
      number: number
      pos: string
      grid: string | null
    }
  }>
}

export interface ApiFootballH2HResponse {
  fixture: ApiFootballFixture
  league: {
    id: number
    name: string
    country: string
    logo: string
    flag: string | null
    season: number
    round: string
  }
  teams: ApiFootballFixtureTeams
  goals: ApiFootballFixtureGoals
  score: ApiFootballFixtureScore
}

// ============================================================================
// Internal Types
// ============================================================================

export type MatchConfidence = 'high' | 'medium' | 'low'
export type MatchMethod = 'betradar_id' | 'kambi_id' | 'fuzzy_match' | 'exact' | 'manual'

export interface TeamMapping {
  svenskaSpelTeamId: number
  apiFootballTeamId: number
  confidence: MatchConfidence
  matchMethod: MatchMethod
  similarity?: number
  betradarId?: string
  kambiId?: string
}

export interface LeagueMapping {
  svenskaSpelLeagueId: number
  apiFootballLeagueId: number
  confidence: MatchConfidence
  matchMethod: MatchMethod
  similarity?: number
}

export interface MatchCandidate {
  id: number
  name: string
  similarity: number
  country?: string
}

export interface UnmappedTeam {
  svenskaSpelTeamId: number
  teamName: string
  leagueName?: string
  countryName?: string
  betradarId?: string
  kambiId?: string
  bestCandidates: MatchCandidate[]
}

// ============================================================================
// Normalized Data Structures (for provider abstraction)
// ============================================================================

export type DataSource = 'api-football' | 'web-scraping' | 'cache'

export interface MatchStatistics {
  matchId: number
  homeTeam: TeamMatchStats
  awayTeam: TeamMatchStats
  source: DataSource
  fetchedAt: Date
}

export interface TeamMatchStats {
  teamId: number
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
  playerId: number
  playerName: string
  reason: string
  type: string
  expectedReturn?: Date
  severity: 'minor' | 'moderate' | 'severe'
}

export interface TeamStatistics {
  teamId: number
  season: number
  form: string // "WWDLL" format
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  homeRecord: { wins: number; draws: number; losses: number }
  awayRecord: { wins: number; draws: number; losses: number }
}

export interface HeadToHeadData {
  team1Id: number
  team2Id: number
  lastMatches: HistoricalMatch[]
  team1Wins: number
  draws: number
  team2Wins: number
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
}
