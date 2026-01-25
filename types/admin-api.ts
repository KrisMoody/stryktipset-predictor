/**
 * Admin API Response Types
 *
 * Type definitions for admin panel API responses.
 * These replace inline `any` types with proper interfaces.
 *
 * Note: Fields are mostly optional to handle varying API response shapes
 * and error states. Use optional chaining when accessing properties.
 */

import type { GameType } from './game-types'
import type { FailedGameWithDraw, DrawCompletionStatus } from './failed-games'

// ============================================================================
// Health Check Responses
// ============================================================================

export interface ScraperHealthMetrics {
  status?: string
  queueSize?: number
  totalProcessed?: number
  last24Hours?: {
    success: number
    failed: number
    rateLimited: number
    total: number
    successRate: number
  }
  queue?: {
    queueLength: number
    processing: boolean
    lastScrapeTime: Date | null
  }
  browser?: {
    initialized: boolean
  }
  error?: string
}

export interface ScraperHealthResponse {
  success: boolean
  health?: ScraperHealthMetrics
  error?: string
}

export interface SvenskaSpelHealthResponse {
  success: boolean
  status?: 'healthy' | 'unhealthy'
  responseTime?: string
  drawsAvailable?: number
  apiEndpoint?: string
  timestamp?: string
  message?: string
  errorCategory?: 'TIMEOUT' | 'CONNECTION' | 'NOT_FOUND' | 'SERVER_ERROR' | 'UNKNOWN'
  error?: string
}

// ============================================================================
// Failed Writes Queue
// ============================================================================

export interface FailedWriteEntry {
  id: string
  timestamp: string
  retryCount: number
  error: string
  dataType: string | null
  operationId: string | null
}

export interface FailedWritesQueueStatus {
  queueSize: number
  maxQueueSize: number
  oldestEntry: string | null
  newestEntry: string | null
  entries: FailedWriteEntry[]
}

export interface FailedWritesResponse {
  success: boolean
  action?: 'retry' | 'clear'
  results?: { succeeded: number; failed: number }
  queueStatus?: FailedWritesQueueStatus
  count?: number
  message?: string
  timestamp?: string
  error?: string
}

// ============================================================================
// Sync Response
// ============================================================================

export interface SyncResponse {
  success: boolean
  gameType?: GameType
  drawsProcessed?: number
  matchesProcessed?: number
  cacheInvalidated?: boolean
  syncType?: 'full'
  windowStatus?: {
    isActive: boolean
    phase?: string
    reason?: string
  }
  error?: string
}

// ============================================================================
// Backfill Responses
// ============================================================================

export interface BackfillOperation {
  id: number | string
  status: string
  startDate?: string
  endDate?: string
  config?: unknown
  progress?: number
  drawsProcessed?: number
  matchesProcessed?: number
  processed_draws?: number
  total_draws?: number
  error?: string
  createdAt?: string
  completedAt?: string | null
  cancelledAt?: string | null
}

export interface BackfillResponse {
  success: boolean
  operationId?: number | string
  trackingUrl?: string
  status?: string
  message?: string
  error?: string
}

// ============================================================================
// Cache Responses
// ============================================================================

export interface CacheStatsResponse {
  keys: number
  inflightRequests: number
}

export interface ClearCacheResponse {
  success: boolean
  cleared?: number
  message?: string
  error?: string
}

// ============================================================================
// Draw Management Responses
// ============================================================================

export interface CurrentDrawInfo {
  id?: number
  draw_number: number
  game_type?: GameType
  draw_date: Date | string
  close_time: Date | string
  status: string
  is_current?: boolean
  matchesWithResults: number
  totalMatches: number
  readyForFinalization?: boolean
  finalizationReason?: string
}

export interface CurrentDrawsResponse {
  success: boolean
  draws?: CurrentDrawInfo[]
  count?: number
  error?: string
}

export interface PendingDrawInfo extends CurrentDrawInfo {
  id: number
  game_type: GameType
  readyForFinalization: boolean
  finalizationReason: string
}

export interface PendingFinalizationResponse {
  success: boolean
  readyForFinalization?: PendingDrawInfo[]
  notReady?: PendingDrawInfo[]
  counts?: {
    total: number
    ready: number
    notReady: number
  }
  error?: string
}

// ============================================================================
// Failed Games Response
// ============================================================================

export interface FailedGamesResponse {
  success: boolean
  failedGames?: FailedGameWithDraw[]
  incompleteDraws?: DrawCompletionStatus[]
  counts?: {
    pendingGames: number
    incompleteDraws: number
  }
  error?: string
}

// ============================================================================
// Draw Lookup Response
// ============================================================================

export interface DrawLookupMatch {
  id: number
  matchNumber: number
  matchId: number
  startTime: Date | string
  status: string
  homeTeam: { id: number; name: string; short_name: string | null } | null
  awayTeam: { id: number; name: string; short_name: string | null } | null
  league: {
    id: number
    name: string
    country: { name: string } | null
  } | null
  result: {
    home: number | null
    away: number | null
    outcome: string | null
  }
  odds: {
    current: { home: number; draw: number; away: number } | null
    start: { home: number; draw: number; away: number } | null
  }
  svenskaFolket: { home: number; draw: number; away: number } | null
  expertTips: { home: number; draw: number; away: number } | null
  prediction: {
    home: number
    draw: number
    away: number
    recommended: string
    confidence: string
  } | null
}

export interface DrawLookupDraw {
  id: number
  drawNumber: number
  gameType: GameType
  drawDate: Date | string
  closeTime: Date | string
  status: string
  isCurrent: boolean
  netSale: string | null
  totalMatches: number
  matchesWithResults: number
  matches: DrawLookupMatch[]
}

// Allow flexible draw lookup response for different API states
export interface DrawLookupResponse {
  success: boolean
  found: boolean
  drawNumber?: number
  gameType?: GameType
  message?: string
  draw?: DrawLookupDraw | Record<string, unknown>
  error?: string
}

// Type guard for DrawLookupDraw
export function isDrawLookupDraw(draw: unknown): draw is DrawLookupDraw {
  return (
    typeof draw === 'object' &&
    draw !== null &&
    'id' in draw &&
    'drawNumber' in draw &&
    'matches' in draw
  )
}

// ============================================================================
// API-Football Result Fetch Response
// ============================================================================

export interface FetchedResultItem {
  matchId?: number
  matchNumber: number
  homeTeam: string
  awayTeam: string
  currentResult?: { home: number | null; away: number | null }
  existingResult?: { home: number; away: number; outcome: string } | null
  fetchedResult: {
    home?: number
    away?: number
    homeGoals?: number
    awayGoals?: number
    outcome?: string
    isFinished?: boolean
    isTerminal?: boolean
    rawStatus?: string
  } | null
  status?: 'found' | 'not_found' | 'mismatch' | 'unchanged'
  hasDiscrepancy?: boolean
  apiFootballFixtureId?: number
  error?: string
}

export interface FetchResultsResponse {
  success: boolean
  drawId?: number
  results?: FetchedResultItem[]
  summary?: {
    total: number
    readyToCommit: number
    terminalStatuses: number
    inProgress: number
    errors: number
    discrepancies: number
  }
  hasDiscrepancies?: boolean
  discrepancyDetails?: string[]
  matchesFound?: number
  matchesMissing?: number
  error?: string
}

export interface CommitResultsResponse {
  success: boolean
  updated?: number
  skipped?: number
  error?: string
}

// ============================================================================
// Draw Details (for modals)
// ============================================================================

export interface DrawDetails {
  id: number
  drawNumber: number
  gameType: GameType
  drawDate: Date | string
  closeTime: Date | string
  status: string
  isCurrent: boolean
  netSale: string | null
  totalMatches: number
  matchesWithResults: number
  matches: DrawLookupMatch[]
}
