/**
 * API-Football Integration Module
 *
 * Provides data enrichment from API-Football with automatic fallback
 * to web scraping when API is unavailable.
 */

// Client
export { ApiFootballClient, getApiFootballClient } from './client'
export type { ApiFootballConfig, ApiFootballResponse } from './client'

// Types
export * from './types'

// Matchers
export { LeagueMatcher, getLeagueMatcher } from './league-matcher'
export { TeamMatcher, getTeamMatcher } from './team-matcher'

// Enrichment
export { MatchEnrichmentService, getMatchEnrichmentService } from './match-enrichment'
export type { EnrichmentResult, BatchEnrichmentResult } from './match-enrichment'

// Result Fallback
export {
  ResultFallbackService,
  getResultFallbackService,
  resultFallbackService,
} from './result-fallback-service'
export { extractResultFromFixture } from './result-fallback-service'
export type {
  ExtractedResult,
  MatchResultStatus,
  FetchedResult,
  DrawResultStatus,
  SyncResult,
} from './result-fallback-service'
