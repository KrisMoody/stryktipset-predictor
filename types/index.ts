/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic API data structures require any types */
// Type definitions for Svenska Spel API and application data structures

/**
 * Database entities (from Prisma)
 */

/**
 * Team entity
 */
export interface Team {
  id: number
  name: string
  short_name: string | null
  medium_name: string | null
  created_at: Date
  updated_at: Date
}

/**
 * Country entity
 */
export interface Country {
  id: number
  name: string
  iso_code: string | null
  created_at: Date
  updated_at: Date
}

/**
 * League entity
 */
export interface League {
  id: number
  name: string
  country_id: number
  created_at: Date
  updated_at: Date
  country?: Country
}

/**
 * Draw data from Svenska Spel API
 */
export interface DrawData {
  productName: string
  drawNumber: number
  drawState: string
  regCloseTime: string
  drawEvents: DrawEventData[]
  currentNetSale?: string
  drawDate?: string
  weekNumber?: number
  year?: number
  productId?: number
  is_current?: boolean // Track if draw is current or historic
  archived_at?: Date // When draw was archived
  // Additional fields from API
  [key: string]: any
}

/**
 * Draw event (match) data from Svenska Spel API
 */
export interface DrawEventData {
  eventNumber: number
  eventDescription: string
  match: MatchApiData
  odds?: OddsData
  startOdds?: OddsData
  favouriteOdds?: OddsData
  svenskaFolket?: SvenskaFolketData
  betMetrics?: BetMetricsData
  tioTidningarsTips?: ExpertTipsData
  providerIds?: ProviderIdData[]
  cancelled?: boolean
  eventComment?: string
  extraInfo?: string | null
  eventTypeId?: number
  participantType?: string
  complementaryBetMetrics?: any[]
  outcomes?: any
  // Additional fields from API
  [key: string]: any
}

/**
 * Match data structure from API
 */
export interface MatchApiData {
  matchId: number
  matchStart: string
  status: string
  statusId?: number
  sportEventStatus?: string
  statusTime?: string
  coverage?: number
  participants: ParticipantData[]
  league: LeagueData
  result?: ResultData[]
  // Additional fields
  [key: string]: any
}

/**
 * Participant (team) data
 */
export interface ParticipantData {
  id: number
  name: string
  type: string // "home", "away", "Team"
  shortName?: string
  mediumName?: string
  countryId?: number
  countryName?: string
  isoCode?: string
  result?: string // Final result for this participant
  // Additional fields
  [key: string]: any
}

/**
 * Country data
 */
export interface CountryData {
  id: number
  name: string
  isoCode?: string
  [key: string]: any
}

/**
 * League data
 */
export interface LeagueData {
  id: number
  name: string
  country?: string | CountryData
  countryId?: number
  // Additional fields
  [key: string]: any
}

/**
 * Result data
 */
export interface ResultData {
  home: number
  away: number
  type?: string
  // Additional fields
  [key: string]: any
}

/**
 * Odds data
 */
export interface OddsData {
  one: string // Home win odds
  x: string // Draw odds
  two: string // Away win odds
  // Additional fields
  [key: string]: any
}

/**
 * Svenska Folket (crowd) betting distribution
 */
export interface SvenskaFolketData {
  one: string // Percentage betting on home
  x: string // Percentage betting on draw
  two: string // Percentage betting on away
  date?: string // When distribution was recorded
  refOne?: string // Reference distribution for home
  refX?: string // Reference distribution for draw
  refTwo?: string // Reference distribution for away
  refDate?: string // Reference distribution date
}

/**
 * Expert tips from "Tio Tidningars Tips"
 */
export interface ExpertTipsData {
  one: number // Number of experts picking home win
  x: number // Number of experts picking draw
  two: number // Number of experts picking away win
}

/**
 * Bet metrics with distribution data
 */
export interface BetMetricsData {
  eventTypeId: number
  eventType: string // "1X2"
  eventSubTypeId: number
  eventSubType: string // "Fulltid"
  distributionDate: string
  distributionRefDate?: string
  values: BetMetricsValue[]
}

/**
 * Individual bet metrics value
 */
export interface BetMetricsValue {
  outcome: string // "1", "X", "2"
  odds?: {
    odds: string | null
    favouriteOdds: string | null
    startOdds: string | null
  }
  distribution: {
    distribution: string
    refDistribution?: string
  }
}

/**
 * Provider IDs for external data sources
 */
export interface ProviderIdData {
  provider: string // "BetRadar", "Kambi"
  type: string // "Normal"
  id: string
}

/**
 * Scraped data types
 */
export interface XStatsData {
  homeTeam: {
    entireSeason?: XStatsValues
    lastFiveGames?: XStatsValues
    entireSeasonHome?: XStatsValues
    lastFiveGamesHome?: XStatsValues
  }
  awayTeam: {
    entireSeason?: XStatsValues
    lastFiveGames?: XStatsValues
    entireSeasonAway?: XStatsValues
    lastFiveGamesAway?: XStatsValues
  }
  [key: string]: any
}

export interface XStatsValues {
  xg?: string // Expected goals
  xga?: string // Expected goals against
  xgd?: string // Expected goal difference
  xp?: string // Expected points
  [key: string]: any
}

export interface StatisticsData {
  homeTeam: {
    position?: number
    points?: number
    played?: number
    won?: number
    drawn?: number
    lost?: number
    goalsFor?: number
    goalsAgainst?: number
    form?: string[] // ["W", "L", "D", etc.]
    [key: string]: any
  }
  awayTeam: {
    position?: number
    points?: number
    played?: number
    won?: number
    drawn?: number
    lost?: number
    goalsFor?: number
    goalsAgainst?: number
    form?: string[] // ["W", "L", "D", etc.]
    [key: string]: any
  }
  [key: string]: any
}

export interface HeadToHeadData {
  matches: HeadToHeadMatch[]
  summary?: {
    homeWins: number
    draws: number
    awayWins: number
    totalMatches: number
  }
  [key: string]: any
}

export interface HeadToHeadMatch {
  date: string
  homeTeam: string
  awayTeam: string
  score: string
  competition?: string
  [key: string]: any
}

export interface NewsData {
  articles: NewsArticle[]
  [key: string]: any
}

export interface NewsArticle {
  title: string
  content?: string
  date?: string
  source?: string
  [key: string]: any
}

/**
 * AI Prediction model options
 */
export type PredictionModel = 'claude-sonnet-4-5' | 'claude-opus-4-5'

/**
 * AI Prediction structure
 */
export interface PredictionData {
  probabilities: {
    home_win: number
    draw: number
    away_win: number
  }
  reasoning: string
  key_factors: string[]
  recommended_bet: '1' | 'X' | '2' | '1X' | 'X2' | '12'
  suitable_as_spik: boolean
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Expected Value calculation
 */
export interface ExpectedValue {
  outcome: '1' | 'X' | '2'
  probability: number
  crowd_probability: number
  odds: number
  ev: number
  is_value_bet: boolean
}

/**
 * Coupon system selection
 */
export interface CouponSelection {
  matchNumber: number
  homeTeam: string
  awayTeam: string
  selection: string // "1", "X", "2", "1X", "X2", "12", "1X2"
  is_spik: boolean
  expected_value: number
  reasoning: string
}

/**
 * Optimal coupon system
 */
export interface OptimalCoupon {
  drawNumber: number
  selections: CouponSelection[]
  totalCombinations: number
  totalCost: number
  expectedValue: number
  budget: number
}

/**
 * Betting system definition (R-system or U-system)
 */
export interface BettingSystem {
  id: string // e.g., "R-4-0-9-12"
  type: 'R' | 'U'
  helgarderingar: number // Full hedges (1X2)
  halvgarderingar: number // Half hedges (1X, X2, or 12)
  rows: number // Total rows in reduced system
  guarantee?: number // For R-systems: 10, 11, or 12 rätt guarantee
}

/**
 * System-based coupon (using R or U-system)
 */
export interface SystemCoupon {
  drawNumber: number
  system: BettingSystem
  selections: CouponSelection[] // AI suggestions for hedging
  utgangstecken?: Record<number, string> // For U-systems: matchNumber -> outcome
  rows: CouponRow[]
  totalCost: number
  expectedValue: number
}

/**
 * Single row in a coupon
 */
export interface CouponRow {
  rowNumber: number
  picks: string[] // Array of 13 outcomes ["1", "X", "2", ...]
}

/**
 * Coupon status for tracking lifecycle
 */
export type CouponStatus = 'generated' | 'saved' | 'played' | 'analyzed'

/**
 * Persisted coupon data (from database)
 */
export interface PersistedCoupon {
  id: number
  drawNumber: number
  systemId: string | null
  mode: 'ai' | 'r-system' | 'u-system'
  status: CouponStatus
  version: number
  utgangstecken: Record<number, string> | null
  mgExtensions: MGExtension[] | null
  selections: CouponSelection[]
  rows: CouponRow[]
  totalCost: number
  expectedValue: number
  budget: number | null
  performanceId: number | null
  savedAt: Date | null
  playedAt: Date | null
  analyzedAt: Date | null
  createdAt: Date
}

/**
 * Extended optimal coupon with persistence data
 */
export interface OptimalCouponWithPersistence extends OptimalCoupon {
  id: number
  status: CouponStatus
  version: number
}

/**
 * Extended system coupon with persistence data
 */
export interface SystemCouponWithPersistence extends SystemCoupon {
  id: number
  status: CouponStatus
  version: number
}

/**
 * Hedge assignment for matches
 */
export interface HedgeAssignment {
  spiks: number[] // Match numbers that are spiked (single outcome)
  helgarderingar: number[] // Matches with full hedges (1X2)
  halvgarderingar: number[] // Matches with half hedges (1X, X2, 12)
  spikOutcomes: Record<number, string> // matchNumber -> outcome for spiks
}

/**
 * Matematiska garderingar (MG) extension
 */
export interface MGExtension {
  matchNumber: number
  type: 'hel' | 'halv' // Full hedge or half hedge
  outcomes?: string[] // For half hedge: which 2 outcomes to cover (e.g., ["1", "X"])
}

/**
 * Historical performance data for a system
 */
export interface SystemPerformance {
  systemId: string
  drawNumber: number
  correctPredictions: number // How many matches were correct
  hadWinningRow: boolean // Did any row get 13 rätt?
  bestRowScore: number // Highest number of correct picks in any row
  actualCost: number
  potentialPayout: number
  analyzedAt: Date
}

/**
 * Scraping options
 */
export interface ScrapeOptions {
  matchId: number
  drawNumber: number
  matchNumber: number
  dataTypes: ('xStats' | 'statistics' | 'headToHead' | 'news')[]
  timeout?: number
  retries?: number
  userId?: string
}

/**
 * Scraping result
 */
export interface ScrapeResult {
  success: boolean
  matchId: number
  dataType: string
  data?: any
  error?: string
  duration: number
  timestamp: Date
}

/**
 * Multifetch API response wrapper
 */
export interface MultifetchResponse {
  requestId: string
  deviceId?: string
  requestInfo?: {
    dataSource?: string
    elapsedTime: number
    apiVersion?: number
  }
  responses: MultifetchResponseItem[]
}

/**
 * Individual response item in multifetch
 */
export interface MultifetchResponseItem {
  draw?: DrawData
  jackpot?: JackpotData
  error?: {
    code: number
    message: string
  } | null
  requestInfo?: {
    elapsedTime: number
    apiVersion?: number
  }
  requestId?: string
  sessionId?: string | null
  deviceId?: string
  session?: any
  sessionUser?: any
  clientInfo?: any
}

/**
 * Jackpot data from API
 */
export interface JackpotData {
  draws: Array<{
    productId: number
    productName: string
    drawNumber: number
    regCloseTime: string
    events: any[]
  }>
  [key: string]: any
}

/**
 * Draw result with prize distribution
 */
export interface DrawResultData {
  drawNumber: number
  productName?: string
  distributions?: DistributionData[]
  correctRow?: string
  totalBets?: number
  totalPrizePool?: number
  [key: string]: any
}

/**
 * Prize distribution data
 */
export interface DistributionData {
  outcome: string
  winners: number
  prize: number
  [key: string]: any
}

/**
 * Available draws from date picker API
 */
export interface AvailableDrawsData {
  year?: number
  month?: number
  draws?: Array<{
    date: string
    drawNumber: number
    product?: string
    [key: string]: any
  }>
  [key: string]: any
}

/**
 * Realtime scraping status for a specific data type
 */
export interface RealtimeScrapingStatus {
  dataType: string
  status: 'idle' | 'started' | 'in_progress' | 'success' | 'failed' | 'rate_limited'
  message?: string
  error?: string
  startedAt?: Date
  completedAt?: Date
  durationMs?: number
  retryCount?: number
}

/**
 * Supabase realtime event payload for scrape_operations
 */
export interface ScrapingOperationEvent {
  id: number
  match_id: number | null
  operation_type: string
  status: string
  error_message?: string | null
  response_code?: number | null
  duration_ms?: number | null
  retry_count: number
  started_at: string
  completed_at?: string | null
}

/**
 * Supabase realtime event payload for match_scraped_data
 */
export interface ScrapedDataEvent {
  id: number
  match_id: number
  data_type: string
  data: any
  scraped_at: string
}

/**
 * URL pattern type for scraping
 */
export type UrlPattern = 'current' | 'historic'

/**
 * Scraping method type
 */
export type ScrapingMethod = 'direct_url' | 'tab_clicking' | 'hybrid' | 'ai'

/**
 * URL build context for constructing scraping URLs
 */
export interface UrlBuildContext {
  matchNumber: number // 1-13
  drawNumber: number
  drawDate: Date
  isCurrent: boolean
}

/**
 * Draw lifecycle status
 */
export interface DrawLifecycleStatus {
  draw_number: number
  is_current: boolean
  archived_at: Date | null
  should_archive: boolean
  reason?: string
}

/**
 * Scraper analytics data
 */
export interface ScraperAnalytics {
  method: ScrapingMethod
  urlPattern: UrlPattern
  domain: string
  dataType: string
  success: boolean
  duration: number
  error?: string
  timestamp: Date
}

/**
 * Domain test result
 */
export interface DomainTestResult {
  domain: string
  working: boolean
  responseTime?: number
  error?: string
}

/**
 * AI Metrics types
 */

/**
 * AI usage record from database
 */
export interface AIUsageRecord {
  id: number
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  data_type: string | null
  operation_id: string | null
  endpoint: string | null
  duration_ms: number | null
  success: boolean
  timestamp: Date
}

/**
 * Overall AI metrics summary
 */
export interface AIMetricsOverview {
  totalCost: number
  totalTokens: number
  totalInputTokens: number
  totalOutputTokens: number
  totalRequests: number
  successRate: number
  averageCostPerRequest: number
  averageDuration: number
  dateRange: {
    start: Date
    end: Date
  }
}

/**
 * Cost breakdown by model
 */
export interface ModelCostBreakdown {
  model: string
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  totalCost: number
  averageCostPerRequest: number
  successRate: number
  description?: string
}

/**
 * Cost breakdown by operation type
 */
export interface OperationCostBreakdown {
  dataType: string
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  totalCost: number
  averageCostPerRequest: number
  averageTokensPerRequest: number
  successRate: number
}

/**
 * Time-series data point for trends
 */
export interface CostTrendDataPoint {
  date: string
  cost: number
  tokens: number
  requests: number
  successRate: number
}

/**
 * Cost trends over time
 */
export interface CostTrends {
  daily: CostTrendDataPoint[]
  weekly: CostTrendDataPoint[]
  monthly: CostTrendDataPoint[]
}

/**
 * Token efficiency metrics
 */
export interface TokenEfficiencyMetrics {
  averageTokensPerPrediction: number
  averageTokensPerScrape: number
  averageTokensPerEmbedding: number
  costPerPrediction: number
  costPerScrape: number
  costPerEmbedding: number
  mostExpensiveOperations: {
    operationId: string
    dataType: string
    model: string
    cost: number
    tokens: number
    timestamp: Date
  }[]
}

/**
 * Budget analysis
 */
export interface BudgetAnalysis {
  currentMonthSpending: number
  lastMonthSpending: number
  projectedMonthlySpending: number
  dailyAverageSpending: number
  remainingDaysInMonth: number
  percentageChange: number
  trend: 'increasing' | 'decreasing' | 'stable'
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  id: string
  type: 'cost' | 'efficiency' | 'performance' | 'info'
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  potentialSavings?: number
  action?: string
}

/**
 * Complete AI metrics data
 */
export interface AIMetricsData {
  overview: AIMetricsOverview
  modelBreakdown: ModelCostBreakdown[]
  operationBreakdown: OperationCostBreakdown[]
  trends: CostTrends
  efficiency: TokenEfficiencyMetrics
  budget: BudgetAnalysis
  recommendations: OptimizationRecommendation[]
}

/**
 * Date range filter
 */
export interface DateRangeFilter {
  start: Date
  end: Date
  preset?: 'today' | '7days' | '30days' | 'thisMonth' | 'lastMonth' | 'all'
}

/**
 * AI metrics export data for CSV
 */
export interface AIMetricsExportData {
  timestamp: Date
  model: string
  dataType: string
  operationId: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  duration: number
  success: boolean
  endpoint: string
}

/**
 * Schedule Window Types
 *
 * Used for managing the Stryktipset betting window schedule:
 * - Active window: Tuesday 00:00 → Saturday 15:59 (Stockholm timezone)
 * - Outside window: Sunday, Monday, Saturday after 16:00
 */

/**
 * Current schedule window status
 */
export interface ScheduleWindowStatus {
  /** Whether currently in active betting window */
  isActive: boolean
  /** Current phase: early (Tue-Thu), mid (Fri), late (Sat morning), closed */
  currentPhase: 'early' | 'mid' | 'late' | 'closed'
  /** Next spelstopp time (Saturday 15:59) if in active window */
  closeTime: Date | string | null
  /** Next window open time (Tuesday 00:00) if outside window */
  openTime: Date | string | null
  /** Minutes until spelstopp */
  minutesUntilClose: number | null
  /** Minutes until window opens */
  minutesUntilOpen: number | null
  /** Current scraping intensity based on phase */
  scrapingIntensity: 'normal' | 'aggressive' | 'very_aggressive'
  /** Hours threshold for data freshness - refresh data older than this */
  dataRefreshThreshold: number
  /** Human-readable explanation of current status */
  reason: string
  /** Current Stockholm time (for debugging) */
  stockholmTime?: string
}

/**
 * Permission check result for schedule-restricted operations
 */
export interface ScheduleOperationPermission {
  /** Whether operation is allowed */
  allowed: boolean
  /** Explanation of why allowed or not */
  reason: string
}

/**
 * Cost estimation for AI operations (e.g., re-evaluating predictions)
 */
export interface CostEstimation {
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedCost: number
  matchCount: number
  currency: string
  model?: PredictionModel
}
