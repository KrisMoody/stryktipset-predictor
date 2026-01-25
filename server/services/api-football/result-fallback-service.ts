/**
 * Result Fallback Service
 *
 * Fetches match results from API-Football when Svenska Spel results are missing.
 * Supports both automatic (scheduled) and manual (admin triggered) result sync.
 */

import { prisma } from '~/server/utils/prisma'
import { getApiFootballClient } from './client'
import type { ApiFootballFixtureResponse } from './types'
import { getMatchEnrichmentService } from './match-enrichment'
import { drawLifecycle } from '~/server/services/draw-lifecycle'

// ============================================================================
// Types
// ============================================================================

export type MatchStatus =
  | 'FT' // Full Time
  | 'AET' // After Extra Time
  | 'PEN' // After Penalties
  | 'PST' // Postponed
  | 'CANC' // Cancelled
  | 'ABD' // Abandoned
  | 'NS' // Not Started
  | '1H' // First Half
  | 'HT' // Half Time
  | '2H' // Second Half
  | 'ET' // Extra Time
  | 'BT' // Break Time
  | 'P' // Penalty In Progress
  | 'LIVE' // Live (rare)
  | 'SUSP' // Suspended
  | 'INT' // Interrupted
  | 'WO' // Walkover
  | 'AWA' // Technical Loss
  | 'TBD' // Time To Be Defined

export interface ExtractedResult {
  homeGoals: number
  awayGoals: number
  outcome: '1' | 'X' | '2'
  status: MatchStatus
  isFinished: boolean
  isTerminal: boolean // PST, CANC, ABD - no result expected
  rawStatus: string
}

export interface MatchResultStatus {
  matchId: number
  matchNumber: number
  homeTeam: string
  awayTeam: string
  hasResult: boolean
  hasFixtureId: boolean
  fixtureId: number | null
  existingResult: { home: number | null; away: number | null; outcome: string | null } | null
  needsEnrichment: boolean
}

export interface FetchedResult {
  matchId: number
  matchNumber: number
  homeTeam: string
  awayTeam: string
  fetchedResult: ExtractedResult | null
  existingResult: { home: number | null; away: number | null; outcome: string | null } | null
  hasDiscrepancy: boolean
  error?: string
}

export interface DrawResultStatus {
  drawId: number
  drawNumber: number
  gameType: string
  totalMatches: number
  matchesWithResults: number
  matchesMissingResults: number
  matchesWithFixtureId: number
  matchesNeedingEnrichment: number
  matches: MatchResultStatus[]
  canFetchFromApiFootball: boolean
}

export interface SyncResult {
  drawId: number
  drawNumber: number
  totalProcessed: number
  resultsUpdated: number
  statusesUpdated: number // For PST, CANC, etc.
  skipped: number
  errors: number
  details: Array<{
    matchId: number
    matchNumber: number
    action: 'updated' | 'status_updated' | 'skipped' | 'error'
    reason?: string
  }>
  drawArchived: boolean
}

// ============================================================================
// Constants
// ============================================================================

// Statuses that indicate match is finished with a result
const FINISHED_STATUSES: MatchStatus[] = ['FT', 'AET', 'PEN']

// Statuses that indicate match won't have a result (terminal state)
const TERMINAL_STATUSES: MatchStatus[] = ['PST', 'CANC', 'ABD', 'WO', 'AWA']

// Statuses that indicate match is still in progress
const IN_PROGRESS_STATUSES: MatchStatus[] = [
  '1H',
  'HT',
  '2H',
  'ET',
  'BT',
  'P',
  'LIVE',
  'SUSP',
  'INT',
]

// Cache TTL for result fetches (results don't change once finished)
const RESULT_CACHE_TTL = 7 * 24 * 60 * 60 // 7 days

// ============================================================================
// Result Extraction Helpers
// ============================================================================

/**
 * Extract result from API-Football fixture response
 */
export function extractResultFromFixture(
  fixture: ApiFootballFixtureResponse
): ExtractedResult | null {
  const status = fixture.fixture.status.short as MatchStatus

  // Check if finished with result
  const isFinished = FINISHED_STATUSES.includes(status)
  const isTerminal = TERMINAL_STATUSES.includes(status)
  const _isInProgress = IN_PROGRESS_STATUSES.includes(status)

  if (!isFinished && !isTerminal) {
    // Match not finished yet
    return {
      homeGoals: 0,
      awayGoals: 0,
      outcome: 'X',
      status,
      isFinished: false,
      isTerminal,
      rawStatus: fixture.fixture.status.long,
    }
  }

  // For finished matches, use fulltime score (90 min)
  // For AET/PEN, we still want the 90-min result for betting purposes
  let homeGoals: number
  let awayGoals: number

  if (isFinished) {
    // Prefer fulltime score, fall back to goals if fulltime is null
    homeGoals = fixture.score.fulltime.home ?? fixture.goals.home ?? 0
    awayGoals = fixture.score.fulltime.away ?? fixture.goals.away ?? 0
  } else {
    // Terminal status (PST, CANC, ABD) - no result
    homeGoals = 0
    awayGoals = 0
  }

  // Calculate outcome
  let outcome: '1' | 'X' | '2'
  if (homeGoals > awayGoals) {
    outcome = '1'
  } else if (awayGoals > homeGoals) {
    outcome = '2'
  } else {
    outcome = 'X'
  }

  return {
    homeGoals,
    awayGoals,
    outcome,
    status,
    isFinished,
    isTerminal,
    rawStatus: fixture.fixture.status.long,
  }
}

/**
 * Map API-Football status to internal match status string
 */
function mapStatusToInternal(status: MatchStatus): string {
  switch (status) {
    case 'FT':
    case 'AET':
    case 'PEN':
      return 'Completed'
    case 'PST':
      return 'Postponed'
    case 'CANC':
      return 'Cancelled'
    case 'ABD':
      return 'Abandoned'
    case 'WO':
    case 'AWA':
      return 'Walkover'
    case 'NS':
    case 'TBD':
      return 'Not started'
    default:
      return 'In progress'
  }
}

// ============================================================================
// Result Fallback Service
// ============================================================================

export class ResultFallbackService {
  private client = getApiFootballClient()
  private enrichmentService = getMatchEnrichmentService()

  /**
   * Fetch fixture result from API-Football by fixture ID
   */
  async fetchFixtureResult(fixtureId: number): Promise<ExtractedResult | null> {
    if (!this.client.isConfigured()) {
      console.warn('[ResultFallback] API-Football client not configured')
      return null
    }

    try {
      const response = await this.client.get<ApiFootballFixtureResponse[]>(
        '/fixtures',
        { id: fixtureId },
        { cacheTtlSeconds: RESULT_CACHE_TTL }
      )

      if (response.results === 0 || !response.response?.[0]) {
        console.warn(`[ResultFallback] No fixture found for ID ${fixtureId}`)
        return null
      }

      const fixture = response.response[0]
      return extractResultFromFixture(fixture)
    } catch (error) {
      console.error(`[ResultFallback] Error fetching fixture ${fixtureId}:`, error)
      return null
    }
  }

  /**
   * Find draws that need result sync (48h after last match start, missing results)
   */
  async findDrawsNeedingResultSync(): Promise<number[]> {
    const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000)

    // Find draws where:
    // 1. is_current = true
    // 2. Max start_time of matches is > 48h ago
    // 3. At least one match has no outcome
    const draws = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT d.id
      FROM draws d
      WHERE d.is_current = true
        AND EXISTS (
          SELECT 1 FROM matches m
          WHERE m.draw_id = d.id
        )
        AND (
          SELECT MAX(m.start_time) FROM matches m WHERE m.draw_id = d.id
        ) < ${cutoffTime}
        AND EXISTS (
          SELECT 1 FROM matches m
          WHERE m.draw_id = d.id
            AND m.outcome IS NULL
            AND m.status NOT IN ('Postponed', 'Cancelled', 'Abandoned', 'Walkover')
        )
    `

    return draws.map(d => d.id)
  }

  /**
   * Get detailed result status for a draw
   */
  async getDrawResultStatus(drawId: number): Promise<DrawResultStatus | null> {
    const draw = await prisma.draws.findUnique({
      where: { id: drawId },
      select: {
        id: true,
        draw_number: true,
        game_type: true,
        matches: {
          select: {
            id: true,
            match_number: true,
            result_home: true,
            result_away: true,
            outcome: true,
            status: true,
            api_football_fixture_id: true,
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
          },
          orderBy: { match_number: 'asc' },
        },
      },
    })

    if (!draw) {
      return null
    }

    const matches: MatchResultStatus[] = draw.matches.map(m => ({
      matchId: m.id,
      matchNumber: m.match_number,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      hasResult: m.outcome !== null,
      hasFixtureId: m.api_football_fixture_id !== null,
      fixtureId: m.api_football_fixture_id,
      existingResult:
        m.result_home !== null
          ? { home: m.result_home, away: m.result_away, outcome: m.outcome }
          : null,
      needsEnrichment: m.api_football_fixture_id === null,
    }))

    const matchesMissingResults = matches.filter(
      m =>
        !m.hasResult &&
        !['Postponed', 'Cancelled', 'Abandoned', 'Walkover'].includes(
          m.existingResult?.outcome || ''
        )
    )

    return {
      drawId: draw.id,
      drawNumber: draw.draw_number,
      gameType: draw.game_type,
      totalMatches: matches.length,
      matchesWithResults: matches.filter(m => m.hasResult).length,
      matchesMissingResults: matchesMissingResults.length,
      matchesWithFixtureId: matches.filter(m => m.hasFixtureId).length,
      matchesNeedingEnrichment: matchesMissingResults.filter(m => m.needsEnrichment).length,
      matches,
      canFetchFromApiFootball:
        this.client.isConfigured() &&
        matchesMissingResults.some(m => m.hasFixtureId || !m.needsEnrichment),
    }
  }

  /**
   * Fetch result for a single match
   */
  async syncMatchResult(matchId: number): Promise<FetchedResult> {
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        match_number: true,
        result_home: true,
        result_away: true,
        outcome: true,
        api_football_fixture_id: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    })

    if (!match) {
      return {
        matchId,
        matchNumber: 0,
        homeTeam: '',
        awayTeam: '',
        fetchedResult: null,
        existingResult: null,
        hasDiscrepancy: false,
        error: 'Match not found',
      }
    }

    const result: FetchedResult = {
      matchId: match.id,
      matchNumber: match.match_number,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      fetchedResult: null,
      existingResult:
        match.result_home !== null
          ? { home: match.result_home, away: match.result_away, outcome: match.outcome }
          : null,
      hasDiscrepancy: false,
    }

    // If no fixture ID, try to enrich first
    let fixtureId = match.api_football_fixture_id
    if (!fixtureId) {
      try {
        const enrichResult = await this.enrichmentService.enrichMatch(matchId)
        if (enrichResult.fixtureFound) {
          // Refetch to get the fixture ID
          const refreshedMatch = await prisma.matches.findUnique({
            where: { id: matchId },
            select: { api_football_fixture_id: true },
          })
          fixtureId = refreshedMatch?.api_football_fixture_id ?? null
        }
      } catch (error) {
        console.warn(`[ResultFallback] Error enriching match ${matchId}:`, error)
      }
    }

    if (!fixtureId) {
      result.error = 'No API-Football fixture ID available'
      return result
    }

    // Fetch result from API-Football
    const fetchedResult = await this.fetchFixtureResult(fixtureId)
    result.fetchedResult = fetchedResult

    // Check for discrepancy if both have results
    if (fetchedResult?.isFinished && result.existingResult) {
      result.hasDiscrepancy =
        fetchedResult.homeGoals !== result.existingResult.home ||
        fetchedResult.awayGoals !== result.existingResult.away
    }

    return result
  }

  /**
   * Sync results for all matches in a draw
   */
  async syncDrawResults(drawId: number, commitResults: boolean = true): Promise<SyncResult> {
    const draw = await prisma.draws.findUnique({
      where: { id: drawId },
      select: {
        id: true,
        draw_number: true,
        game_type: true,
        matches: {
          where: {
            outcome: null,
            status: { notIn: ['Postponed', 'Cancelled', 'Abandoned', 'Walkover'] },
          },
          select: {
            id: true,
            match_number: true,
            api_football_fixture_id: true,
          },
          orderBy: { match_number: 'asc' },
        },
      },
    })

    if (!draw) {
      return {
        drawId,
        drawNumber: 0,
        totalProcessed: 0,
        resultsUpdated: 0,
        statusesUpdated: 0,
        skipped: 0,
        errors: 0,
        details: [],
        drawArchived: false,
      }
    }

    const result: SyncResult = {
      drawId: draw.id,
      drawNumber: draw.draw_number,
      totalProcessed: draw.matches.length,
      resultsUpdated: 0,
      statusesUpdated: 0,
      skipped: 0,
      errors: 0,
      details: [],
      drawArchived: false,
    }

    console.log(
      `[ResultFallback] Syncing results for draw ${draw.draw_number} (${draw.game_type}): ${draw.matches.length} matches missing results`
    )

    for (const match of draw.matches) {
      const fetchResult = await this.syncMatchResult(match.id)

      if (fetchResult.error) {
        result.errors++
        result.details.push({
          matchId: match.id,
          matchNumber: match.match_number,
          action: 'error',
          reason: fetchResult.error,
        })
        continue
      }

      if (!fetchResult.fetchedResult) {
        result.skipped++
        result.details.push({
          matchId: match.id,
          matchNumber: match.match_number,
          action: 'skipped',
          reason: 'No result from API-Football',
        })
        continue
      }

      const extracted = fetchResult.fetchedResult

      // Handle terminal statuses (PST, CANC, ABD)
      if (extracted.isTerminal) {
        if (commitResults) {
          await prisma.matches.update({
            where: { id: match.id },
            data: {
              status: mapStatusToInternal(extracted.status),
              status_time: new Date(),
            },
          })
        }
        result.statusesUpdated++
        result.details.push({
          matchId: match.id,
          matchNumber: match.match_number,
          action: 'status_updated',
          reason: `Match ${extracted.rawStatus}`,
        })
        continue
      }

      // Skip if not finished
      if (!extracted.isFinished) {
        result.skipped++
        result.details.push({
          matchId: match.id,
          matchNumber: match.match_number,
          action: 'skipped',
          reason: `Match still in progress: ${extracted.rawStatus}`,
        })
        continue
      }

      // Update result
      if (commitResults) {
        await prisma.matches.update({
          where: { id: match.id },
          data: {
            result_home: extracted.homeGoals,
            result_away: extracted.awayGoals,
            outcome: extracted.outcome,
            status: 'Completed',
            status_time: new Date(),
            result_source: 'api-football',
          },
        })

        console.log(
          `[ResultFallback] Updated match ${match.match_number}: ${extracted.homeGoals}-${extracted.awayGoals} (${extracted.outcome})`
        )
      }

      result.resultsUpdated++
      result.details.push({
        matchId: match.id,
        matchNumber: match.match_number,
        action: 'updated',
        reason: `${extracted.homeGoals}-${extracted.awayGoals}`,
      })
    }

    // Check if draw is now complete and archive if so
    if (commitResults && result.resultsUpdated > 0) {
      const status = await drawLifecycle.shouldArchive(draw.draw_number, draw.game_type)
      if (status.should_archive) {
        const archived = await drawLifecycle.archiveDraw(draw.draw_number, draw.game_type)
        result.drawArchived = archived
        if (archived) {
          console.log(`[ResultFallback] Draw ${draw.draw_number} archived after result sync`)
        }
      }
    }

    console.log(
      `[ResultFallback] Sync complete for draw ${draw.draw_number}: ${result.resultsUpdated} updated, ${result.statusesUpdated} status changes, ${result.skipped} skipped, ${result.errors} errors`
    )

    return result
  }

  /**
   * Run automatic result sync for all eligible draws
   */
  async runAutomaticSync(): Promise<{
    drawsProcessed: number
    totalResultsUpdated: number
    totalDrawsArchived: number
    details: SyncResult[]
  }> {
    console.log('[ResultFallback] Starting automatic result sync...')

    const drawIds = await this.findDrawsNeedingResultSync()

    if (drawIds.length === 0) {
      console.log('[ResultFallback] No draws need result sync')
      return {
        drawsProcessed: 0,
        totalResultsUpdated: 0,
        totalDrawsArchived: 0,
        details: [],
      }
    }

    console.log(`[ResultFallback] Found ${drawIds.length} draws needing result sync`)

    const results: SyncResult[] = []
    let totalResultsUpdated = 0
    let totalDrawsArchived = 0

    for (const drawId of drawIds) {
      try {
        const syncResult = await this.syncDrawResults(drawId, true)
        results.push(syncResult)
        totalResultsUpdated += syncResult.resultsUpdated
        if (syncResult.drawArchived) {
          totalDrawsArchived++
        }
      } catch (error) {
        console.error(`[ResultFallback] Error syncing draw ${drawId}:`, error)
      }
    }

    console.log(
      `[ResultFallback] Automatic sync complete: ${drawIds.length} draws, ${totalResultsUpdated} results updated, ${totalDrawsArchived} draws archived`
    )

    return {
      drawsProcessed: drawIds.length,
      totalResultsUpdated,
      totalDrawsArchived,
      details: results,
    }
  }

  /**
   * Preview results that would be fetched (dry run)
   */
  async previewDrawResults(drawId: number): Promise<FetchedResult[]> {
    const draw = await prisma.draws.findUnique({
      where: { id: drawId },
      select: {
        matches: {
          where: {
            outcome: null,
            status: { notIn: ['Postponed', 'Cancelled', 'Abandoned', 'Walkover'] },
          },
          select: { id: true },
          orderBy: { match_number: 'asc' },
        },
      },
    })

    if (!draw) {
      return []
    }

    const results: FetchedResult[] = []
    for (const match of draw.matches) {
      const result = await this.syncMatchResult(match.id)
      results.push(result)
    }

    return results
  }

  /**
   * Validate results between Svenska Spel and API-Football
   * Returns discrepancies for logging/alerting
   */
  async validateResults(
    drawId: number
  ): Promise<Array<{ matchId: number; svenskaSpel: string; apiFootball: string }>> {
    const matches = await prisma.matches.findMany({
      where: {
        draw_id: drawId,
        outcome: { not: null },
        api_football_fixture_id: { not: null },
      },
      select: {
        id: true,
        match_number: true,
        result_home: true,
        result_away: true,
        api_football_fixture_id: true,
      },
    })

    const discrepancies: Array<{ matchId: number; svenskaSpel: string; apiFootball: string }> = []

    for (const match of matches) {
      if (!match.api_football_fixture_id) continue

      const apiResult = await this.fetchFixtureResult(match.api_football_fixture_id)
      if (!apiResult?.isFinished) continue

      if (apiResult.homeGoals !== match.result_home || apiResult.awayGoals !== match.result_away) {
        discrepancies.push({
          matchId: match.id,
          svenskaSpel: `${match.result_home}-${match.result_away}`,
          apiFootball: `${apiResult.homeGoals}-${apiResult.awayGoals}`,
        })
        console.warn(
          `[ResultFallback] Discrepancy in match ${match.match_number}: Svenska Spel=${match.result_home}-${match.result_away}, API-Football=${apiResult.homeGoals}-${apiResult.awayGoals}`
        )
      }
    }

    return discrepancies
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let serviceInstance: ResultFallbackService | null = null

export function getResultFallbackService(): ResultFallbackService {
  if (!serviceInstance) {
    serviceInstance = new ResultFallbackService()
  }
  return serviceInstance
}

export const resultFallbackService = getResultFallbackService()
