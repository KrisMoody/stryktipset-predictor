/**
 * API-Football Response Types
 *
 * Types based on the documented API response structures in docs/API-FOOTBALL-Complete-Documentation.md
 * These types represent the responses from the API-Football v3 API.
 */

// =============================================================================
// Common Types
// =============================================================================

export interface APIFootballResponse<T> {
  get: string
  parameters: Record<string, string>
  errors: string[] | Record<string, string>
  results: number
  paging?: {
    current: number
    total: number
  }
  response: T
}

export interface APIFootballTeamBasic {
  id: number
  name: string
  logo: string
}

export interface APIFootballLeagueBasic {
  id: number
  name: string
  country: string
  logo: string
  flag: string | null
  season: number
}

// =============================================================================
// Fixtures Types
// =============================================================================

export interface APIFootballFixtureStatus {
  long: string
  short: string
  elapsed: number | null
  extra: number | null
}

export interface APIFootballFixtureVenue {
  id: number | null
  name: string | null
  city: string | null
}

export interface APIFootballFixture {
  fixture: {
    id: number
    referee: string | null
    timezone: string
    date: string
    timestamp: number
    periods: {
      first: number | null
      second: number | null
    }
    venue: APIFootballFixtureVenue
    status: APIFootballFixtureStatus
  }
  league: APIFootballLeagueBasic & {
    round: string
    standings?: boolean
  }
  teams: {
    home: APIFootballTeamBasic & { winner: boolean | null }
    away: APIFootballTeamBasic & { winner: boolean | null }
  }
  goals: {
    home: number | null
    away: number | null
  }
  score: {
    halftime: { home: number | null; away: number | null }
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

// =============================================================================
// Predictions Types
// =============================================================================

export interface APIFootballPredictionWinner {
  id: number | null
  name: string | null
  comment: string | null
}

export interface APIFootballPredictionPercent {
  home: string
  draw: string
  away: string
}

export interface APIFootballPredictionGoals {
  home: string
  away: string
}

export interface APIFootballTeamLast5 {
  form: string
  att: string
  def: string
  goals: {
    for: { total: number; average: string }
    against: { total: number; average: string }
  }
}

export interface APIFootballHomeAwayTotal {
  home: number
  away: number
  total: number
}

export interface APIFootballTeamLeagueStats {
  form: string
  fixtures: {
    played: APIFootballHomeAwayTotal
    wins: APIFootballHomeAwayTotal
    draws: APIFootballHomeAwayTotal
    loses: APIFootballHomeAwayTotal
  }
  goals: {
    for: {
      total: APIFootballHomeAwayTotal
      average: { home: string; away: string; total: string }
    }
    against: {
      total: APIFootballHomeAwayTotal
      average: { home: string; away: string; total: string }
    }
  }
  biggest: {
    streak: { wins: number; draws: number; loses: number }
    wins: { home: string | null; away: string | null }
    loses: { home: string | null; away: string | null }
    goals: {
      for: { home: number; away: number }
      against: { home: number; away: number }
    }
  }
  clean_sheet: APIFootballHomeAwayTotal
  failed_to_score: APIFootballHomeAwayTotal
  penalty: {
    scored: { total: number; percentage: string }
    missed: { total: number; percentage: string }
    total: number
  }
  lineups: Array<{ formation: string; played: number }>
  cards: {
    yellow: Record<string, { total: number | null; percentage: string | null }>
    red: Record<string, { total: number | null; percentage: string | null }>
  }
}

export interface APIFootballPredictionTeam {
  id: number
  name: string
  logo: string
  last_5: APIFootballTeamLast5
  league: APIFootballTeamLeagueStats
}

export interface APIFootballPredictionComparison {
  form: { home: string; away: string }
  att: { home: string; away: string }
  def: { home: string; away: string }
  poisson_distribution: { home: string; away: string }
  h2h: { home: string; away: string }
  goals_h2h: { home: string; away: string }
  total: { home: string; away: string }
}

export interface APIFootballPrediction {
  predictions: {
    winner: APIFootballPredictionWinner
    win_or_draw: boolean
    under_over: string | null
    goals: APIFootballPredictionGoals
    advice: string
    percent: APIFootballPredictionPercent
  }
  league: APIFootballLeagueBasic & {
    standings?: { home: number; away: number }
    form?: { home: string; away: string }
    att?: { home: string; away: string }
    def?: { home: string; away: string }
    fish_law?: { home: string; away: string }
    h2h?: { home: string; away: string }
    goals_h2h?: { home: string; away: string }
  }
  teams: {
    home: APIFootballPredictionTeam
    away: APIFootballPredictionTeam
  }
  comparison: APIFootballPredictionComparison
  h2h: APIFootballFixture[]
}

// =============================================================================
// Lineups Types
// =============================================================================

export interface APIFootballLineupPlayer {
  id: number
  name: string
  number: number
  pos: string | null
  grid: string | null
}

export interface APIFootballLineupColors {
  player: { primary: string; number: string; border: string } | null
  goalkeeper: { primary: string; number: string; border: string } | null
}

export interface APIFootballLineupCoach {
  id: number | null
  name: string | null
  photo: string | null
}

export interface APIFootballLineup {
  team: APIFootballTeamBasic & {
    colors: APIFootballLineupColors | null
  }
  coach: APIFootballLineupCoach
  formation: string | null
  startXI: Array<{ player: APIFootballLineupPlayer }>
  substitutes: Array<{ player: APIFootballLineupPlayer }>
}

// =============================================================================
// Injuries Types
// =============================================================================

export interface APIFootballInjury {
  player: {
    id: number
    name: string
    photo: string
    type: string
    reason: string
  }
  team: APIFootballTeamBasic
  fixture: {
    id: number
    timezone: string
    date: string
    timestamp: number
  }
  league: APIFootballLeagueBasic
}

// =============================================================================
// Standings Types
// =============================================================================

export interface APIFootballStandingTeamStats {
  played: number
  win: number
  draw: number
  lose: number
  goals: {
    for: number
    against: number
  }
}

export interface APIFootballStandingEntry {
  rank: number
  team: APIFootballTeamBasic
  points: number
  goalsDiff: number
  group: string
  form: string | null
  status: string | null
  description: string | null
  all: APIFootballStandingTeamStats
  home: APIFootballStandingTeamStats
  away: APIFootballStandingTeamStats
  update: string
}

export interface APIFootballStandings {
  league: APIFootballLeagueBasic & {
    standings: APIFootballStandingEntry[][]
  }
}

// =============================================================================
// Team Statistics Types
// =============================================================================

export interface APIFootballTeamStatisticsGoalsByMinute {
  '0-15': { total: number | null; percentage: string | null }
  '16-30': { total: number | null; percentage: string | null }
  '31-45': { total: number | null; percentage: string | null }
  '46-60': { total: number | null; percentage: string | null }
  '61-75': { total: number | null; percentage: string | null }
  '76-90': { total: number | null; percentage: string | null }
  '91-105': { total: number | null; percentage: string | null }
  '106-120': { total: number | null; percentage: string | null }
}

export interface APIFootballTeamStatistics {
  league: APIFootballLeagueBasic
  team: APIFootballTeamBasic
  form: string
  fixtures: {
    played: APIFootballHomeAwayTotal
    wins: APIFootballHomeAwayTotal
    draws: APIFootballHomeAwayTotal
    loses: APIFootballHomeAwayTotal
  }
  goals: {
    for: {
      total: APIFootballHomeAwayTotal
      average: { home: string; away: string; total: string }
      minute: APIFootballTeamStatisticsGoalsByMinute
    }
    against: {
      total: APIFootballHomeAwayTotal
      average: { home: string; away: string; total: string }
      minute: APIFootballTeamStatisticsGoalsByMinute
    }
  }
  biggest: {
    streak: { wins: number; draws: number; loses: number }
    wins: { home: string | null; away: string | null }
    loses: { home: string | null; away: string | null }
    goals: {
      for: { home: number; away: number }
      against: { home: number; away: number }
    }
  }
  clean_sheet: APIFootballHomeAwayTotal
  failed_to_score: APIFootballHomeAwayTotal
  penalty: {
    scored: { total: number; percentage: string }
    missed: { total: number; percentage: string }
    total: number
  }
  lineups: Array<{ formation: string; played: number }>
  cards: {
    yellow: Record<string, { total: number | null; percentage: string | null }>
    red: Record<string, { total: number | null; percentage: string | null }>
  }
}

// =============================================================================
// Fixture Statistics Types
// =============================================================================

export interface APIFootballFixtureStatistic {
  type: string
  value: number | string | null
}

export interface APIFootballFixtureStatistics {
  team: APIFootballTeamBasic
  statistics: APIFootballFixtureStatistic[]
}

// =============================================================================
// Fixture Events Types
// =============================================================================

export interface APIFootballFixtureEvent {
  time: {
    elapsed: number
    extra: number | null
  }
  team: APIFootballTeamBasic
  player: {
    id: number | null
    name: string | null
  }
  assist: {
    id: number | null
    name: string | null
  }
  type: string
  detail: string
  comments: string | null
}

// =============================================================================
// Fixture Players Types
// =============================================================================

export interface APIFootballFixturePlayerStatistics {
  games: {
    minutes: number | null
    number: number
    position: string
    rating: string | null
    captain: boolean
    substitute: boolean
  }
  offsides: number | null
  shots: { total: number | null; on: number | null }
  goals: {
    total: number | null
    conceded: number | null
    assists: number | null
    saves: number | null
  }
  passes: { total: number | null; key: number | null; accuracy: string | null }
  tackles: { total: number | null; blocks: number | null; interceptions: number | null }
  duels: { total: number | null; won: number | null }
  dribbles: { attempts: number | null; success: number | null; past: number | null }
  fouls: { drawn: number | null; committed: number | null }
  cards: { yellow: number; red: number }
  penalty: {
    won: number | null
    commited: number | null
    scored: number | null
    missed: number | null
    saved: number | null
  }
}

export interface APIFootballFixturePlayer {
  player: {
    id: number
    name: string
    photo: string
  }
  statistics: APIFootballFixturePlayerStatistics[]
}

export interface APIFootballFixturePlayers {
  team: APIFootballTeamBasic & { update: string }
  players: APIFootballFixturePlayer[]
}
