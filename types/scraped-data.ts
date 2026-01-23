/**
 * Scraped Data Type System
 *
 * This file provides type-safe access to match_scraped_data entries using
 * discriminated unions. Each data type has a specific shape, and TypeScript
 * can narrow the type based on the data_type field.
 */

import type { XStatsData, StatisticsData, HeadToHeadData, NewsData } from './index'

import type {
  APIFootballPrediction,
  APIFootballStandingEntry,
  APIFootballTeamStatistics,
} from './api-football'

import type { Prisma } from '@prisma/client'

// =============================================================================
// Base Scraped Data Interface
// =============================================================================

interface BaseScrapedData {
  id: number
  match_id: number
  scraped_at: Date | string
  created_at?: Date | string
  updated_at?: Date | string
}

// =============================================================================
// Lineup Data (from web scraping)
// =============================================================================

export interface LineupTeamData {
  formation?: string | null
  isConfirmed?: boolean
  players?: Array<{
    name: string
    number?: number
    position?: string
    grid?: string
  }>
  unavailable?: Array<{
    name: string
    reason?: string
  }>
}

export interface LineupData {
  homeTeam?: LineupTeamData
  awayTeam?: LineupTeamData
}

// =============================================================================
// Injuries Data (from web scraping)
// =============================================================================

export interface InjuriesDataEntry {
  playerId?: number
  playerName: string
  teamId?: number
  teamName?: string
  type?: string
  reason?: string
  expectedReturn?: string
  severity?: 'severe' | 'moderate' | 'minor'
}

export interface InjuriesData {
  homeTeamId?: number
  awayTeamId?: number
  injuries: InjuriesDataEntry[]
}

// =============================================================================
// Market Odds Data
// =============================================================================

/**
 * Market odds consensus from multiple bookmakers
 */
export interface MarketOddsConsensus {
  fairProbabilities: {
    home: number
    draw: number
    away: number
  }
  fairOdds: {
    home: number
    draw: number
    away: number
  }
  averageMargin: number
  standardDeviation: {
    home: number
    draw: number
    away: number
  }
}

/**
 * Market odds data stored by match-enrichment service
 * Contains odds from multiple bookmakers and market consensus
 */
export interface MarketOddsData {
  fixtureId: number
  bookmakers: string[]
  consensus: MarketOddsConsensus
  bookmakerCount: number
  fetchedAt: string
}

// =============================================================================
// API-Football Scraped Data Types
// =============================================================================

export interface APIPredictionsData {
  predictions: APIFootballPrediction['predictions']
  league?: APIFootballPrediction['league']
  teams?: APIFootballPrediction['teams']
  comparison?: APIFootballPrediction['comparison']
  h2h?: APIFootballPrediction['h2h']
}

/**
 * Normalized lineup player (from match-enrichment)
 */
export interface APILineupsPlayer {
  id: number
  name: string
  number: number
  position: string | null
  grid?: string | null
}

/**
 * Normalized lineup for a single team (from match-enrichment)
 */
export interface APILineupsTeam {
  teamId: number
  teamName: string
  formation: string | null
  coach: {
    id: number | null
    name: string | null
  } | null
  startXI: APILineupsPlayer[]
  substitutes: APILineupsPlayer[]
}

/**
 * Normalized API lineups data (from match-enrichment)
 */
export interface APILineupsData {
  fixtureId: number
  lineups: APILineupsTeam[]
  isConfirmed: boolean
  fetchedAt: string
}

/**
 * Normalized standings entry (from match-enrichment)
 */
export interface StandingsEntry {
  rank: number
  teamId: number
  teamName: string
  teamLogo: string
  points: number
  goalsDiff: number
  group: string
  form: string | null
  status: string | null
  description: string | null
  all: APIFootballStandingEntry['all']
  home: APIFootballStandingEntry['home']
  away: APIFootballStandingEntry['away']
}

export interface StandingsData {
  leagueId: number
  leagueName: string
  season: number
  country: string
  standings: StandingsEntry[]
  fetchedAt: string
}

/**
 * Normalized team season statistics (from match-enrichment)
 */
export interface TeamSeasonStatsTeam {
  id: number
  name: string
  form?: string
  fixtures?: APIFootballTeamStatistics['fixtures']
  goals?: APIFootballTeamStatistics['goals']
  biggest?: APIFootballTeamStatistics['biggest']
  cleanSheet?: APIFootballTeamStatistics['clean_sheet']
  failedToScore?: APIFootballTeamStatistics['failed_to_score']
  penalty?: APIFootballTeamStatistics['penalty']
}

export interface TeamSeasonStatsData {
  leagueId: number
  season: number
  homeTeam: TeamSeasonStatsTeam | null
  awayTeam: TeamSeasonStatsTeam | null
  fetchedAt: string
}

// =============================================================================
// Discriminated Union for All Scraped Data Types
// =============================================================================

export interface XStatsScrapedData extends BaseScrapedData {
  data_type: 'xStats'
  data: XStatsData
}

export interface StatisticsScrapedData extends BaseScrapedData {
  data_type: 'statistics'
  data: StatisticsData
}

export interface LineupScrapedData extends BaseScrapedData {
  data_type: 'lineup'
  data: LineupData
}

export interface HeadToHeadScrapedData extends BaseScrapedData {
  data_type: 'headToHead'
  data: HeadToHeadData
}

export interface NewsScrapedData extends BaseScrapedData {
  data_type: 'news'
  data: NewsData
}

export interface InjuriesScrapedData extends BaseScrapedData {
  data_type: 'injuries'
  data: InjuriesData
}

export interface MarketOddsScrapedData extends BaseScrapedData {
  data_type: 'market_odds'
  data: MarketOddsData
}

export interface APIPredictionsScrapedData extends BaseScrapedData {
  data_type: 'api_predictions'
  data: APIPredictionsData
}

export interface APILineupsScrapedData extends BaseScrapedData {
  data_type: 'api_lineups'
  data: APILineupsData
}

export interface StandingsScrapedData extends BaseScrapedData {
  data_type: 'standings'
  data: StandingsData
}

export interface TeamSeasonStatsScrapedData extends BaseScrapedData {
  data_type: 'team_season_stats'
  data: TeamSeasonStatsData
}

// Generic fallback for unknown data types
export interface UnknownScrapedData extends BaseScrapedData {
  data_type: string
  data: unknown
}

/**
 * Raw scraped data as returned by Prisma (before type narrowing).
 * Use this in interfaces for Prisma query results.
 */
export interface RawScrapedData {
  id: number
  match_id: number
  data_type: string
  data: Prisma.JsonValue
  source?: string
  is_stale?: boolean
  scraped_at: Date | string
  created_at?: Date | string
  updated_at?: Date | string
}

/**
 * Discriminated union of all known scraped data types
 */
export type ScrapedDataEntry =
  | XStatsScrapedData
  | StatisticsScrapedData
  | LineupScrapedData
  | HeadToHeadScrapedData
  | NewsScrapedData
  | InjuriesScrapedData
  | MarketOddsScrapedData
  | APIPredictionsScrapedData
  | APILineupsScrapedData
  | StandingsScrapedData
  | TeamSeasonStatsScrapedData

/**
 * All possible data_type values
 */
export type ScrapedDataType = ScrapedDataEntry['data_type']

// =============================================================================
// Type-safe accessor functions
// =============================================================================

/**
 * Type mapping from data_type string to the corresponding data shape
 */
export type ScrapedDataMap = {
  xStats: XStatsData
  statistics: StatisticsData
  lineup: LineupData
  headToHead: HeadToHeadData
  news: NewsData
  injuries: InjuriesData
  market_odds: MarketOddsData
  api_predictions: APIPredictionsData
  api_lineups: APILineupsData
  standings: StandingsData
  team_season_stats: TeamSeasonStatsData
}

/**
 * Get scraped data of a specific type from a match.
 * Returns the data payload or null if not found.
 * Accepts both typed ScrapedDataEntry[] and raw Prisma RawScrapedData[].
 *
 * @example
 * const xStats = getScrapedData(match.match_scraped_data, 'xStats')
 * // xStats is typed as XStatsData | null
 */
export function getScrapedData<T extends keyof ScrapedDataMap>(
  scrapedData: ScrapedDataEntry[] | RawScrapedData[] | null | undefined,
  type: T
): ScrapedDataMap[T] | null {
  if (!scrapedData) return null
  const entry = scrapedData.find(d => d.data_type === type)
  if (!entry) return null
  return entry.data as ScrapedDataMap[T]
}

/**
 * Get the full scraped data entry (including metadata) of a specific type.
 * Returns the full entry or null if not found.
 * Accepts both typed ScrapedDataEntry[] and raw Prisma RawScrapedData[].
 *
 * @example
 * const entry = getScrapedDataEntry(match.match_scraped_data, 'xStats')
 * // entry is typed as XStatsScrapedData | null
 */
export function getScrapedDataEntry<T extends keyof ScrapedDataMap>(
  scrapedData: ScrapedDataEntry[] | RawScrapedData[] | null | undefined,
  type: T
): Extract<ScrapedDataEntry, { data_type: T }> | null {
  if (!scrapedData) return null
  const entry = scrapedData.find(d => d.data_type === type)
  if (!entry) return null
  return entry as Extract<ScrapedDataEntry, { data_type: T }>
}

/**
 * Type guard to check if an entry is of a specific data type
 *
 * @example
 * if (isScrapedDataType(entry, 'xStats')) {
 *   // entry.data is now typed as XStatsData
 * }
 */
export function isScrapedDataType<T extends keyof ScrapedDataMap>(
  entry: ScrapedDataEntry | UnknownScrapedData,
  type: T
): entry is Extract<ScrapedDataEntry, { data_type: T }> {
  return entry.data_type === type
}

// =============================================================================
// Match With Relations Types
// =============================================================================

/**
 * Team entity from database (matches Prisma teams model)
 */
export interface MatchTeam {
  id: number
  name: string
  short_name: string | null
  medium_name: string | null
  created_at: Date
  updated_at: Date
}

/**
 * Country entity from database (matches Prisma countries model)
 */
export interface MatchCountry {
  id: number
  name: string
  iso_code: string | null
  created_at: Date
  updated_at: Date
}

/**
 * League entity with country relation (matches Prisma leagues model with include)
 */
export interface MatchLeague {
  id: number
  name: string
  country_id: number
  created_at: Date
  updated_at: Date
  country?: MatchCountry
}

/**
 * Odds entry from database (matches Prisma match_odds model)
 * Uses Prisma.Decimal for odds/probability fields
 */
export interface MatchOddsEntry {
  id: number
  match_id: number
  source: string
  type: string
  home_odds: Prisma.Decimal
  draw_odds: Prisma.Decimal
  away_odds: Prisma.Decimal
  home_probability: Prisma.Decimal
  draw_probability: Prisma.Decimal
  away_probability: Prisma.Decimal
  svenska_folket_home: string | null
  svenska_folket_draw: string | null
  svenska_folket_away: string | null
  tio_tidningars_tips_home: string | null
  tio_tidningars_tips_draw: string | null
  tio_tidningars_tips_away: string | null
  collected_at: Date
}

/**
 * Draw entity from database (matches Prisma draws model)
 */
export interface MatchDraw {
  id: number
  draw_number: number
  game_type: string
  draw_date: Date
  close_time: Date
  status: string
  net_sale: Prisma.Decimal | null
  product_id: number | null
  raw_data: unknown | null
  is_current: boolean
  archived_at: Date | null
  created_at: Date
  updated_at: Date
}

/**
 * Match with all relations included.
 * This type represents a match fetched with Prisma includes for:
 * - homeTeam, awayTeam (teams)
 * - league (with country)
 * - match_odds
 * - match_scraped_data
 * - draws
 *
 * Use this type for functions like prepareMatchContext and createMatchText
 * that need full match data.
 *
 * @example
 * const match = await prisma.matches.findUnique({
 *   where: { id: matchId },
 *   include: {
 *     draws: true,
 *     homeTeam: true,
 *     awayTeam: true,
 *     league: { include: { country: true } },
 *     match_odds: { orderBy: { collected_at: 'desc' } },
 *     match_scraped_data: true,
 *   },
 * })
 * // match is typed as MatchWithRelations
 */
export interface MatchWithRelations {
  // Core match fields
  id: number
  draw_id: number
  match_number: number
  match_id: number
  home_team_id: number
  away_team_id: number
  league_id: number
  start_time: Date
  status: string
  status_time: Date | null
  result_home: number | null
  result_away: number | null
  outcome: string | null
  coverage: number | null
  betRadar_id: string | null
  kambi_id: string | null
  raw_data: unknown | null
  created_at: Date
  updated_at: Date

  // API-Football mapping fields
  api_football_fixture_id: number | null
  api_football_league_id: number | null
  api_football_home_team_id: number | null
  api_football_away_team_id: number | null
  mapping_confidence: string | null

  // Relations
  homeTeam: MatchTeam
  awayTeam: MatchTeam
  league: MatchLeague
  draws: MatchDraw
  match_odds: MatchOddsEntry[]
  match_scraped_data: RawScrapedData[]
}

/**
 * Partial match with optional relations.
 * Use this when not all relations are included in the query.
 */
export interface MatchWithPartialRelations {
  // Core match fields (always present)
  id: number
  draw_id: number
  match_number: number
  match_id: number
  home_team_id: number
  away_team_id: number
  league_id: number
  start_time: Date
  status: string
  status_time: Date | null
  result_home: number | null
  result_away: number | null
  outcome: string | null
  coverage: number | null
  betRadar_id: string | null
  kambi_id: string | null
  raw_data: unknown | null
  created_at: Date
  updated_at: Date

  // API-Football mapping fields
  api_football_fixture_id: number | null
  api_football_league_id: number | null
  api_football_home_team_id: number | null
  api_football_away_team_id: number | null
  mapping_confidence: string | null

  // Optional relations
  homeTeam?: MatchTeam
  awayTeam?: MatchTeam
  league?: MatchLeague
  draws?: MatchDraw
  match_odds?: MatchOddsEntry[]
  match_scraped_data?: RawScrapedData[]
}
