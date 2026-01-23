import { prisma } from '~/server/utils/prisma'
import { createApiClient } from './svenska-spel-api'
import { failedGamesService } from './failed-games-service'
import { getMatchEnrichmentService } from './api-football'
import {
  recalculateDrawStatistics,
  updateRatingsForCompletedMatch,
} from './statistical-calculations'
import { drawLifecycle } from './draw-lifecycle'
import { drawCacheService } from './draw-cache-service'
import type {
  DrawData,
  DrawEventData,
  ProviderIdData,
  GameType,
  ParticipantData,
  CountryData,
  LeagueData,
  ExpertTipsData,
  BetMetricsData,
  SvenskaFolketData,
} from '~/types'
import { DEFAULT_GAME_TYPE } from '~/types/game-types'
import Anthropic from '@anthropic-ai/sdk'
import type { Prisma } from '@prisma/client'

/**
 * Odds data from Svenska Spel API (1X2 format)
 */
interface OddsData1X2 {
  one?: string
  x?: string
  two?: string
}

/**
 * Service for syncing draw and match data from Svenska Spel API to database
 * Supports multiple game types: Stryktipset, Europatipset, Topptipset
 */
export class DrawSyncService {
  /**
   * Categorize error type for better debugging
   */
  private categorizeError(error: unknown): { category: string; message: string } {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (message.includes('timeout') || message.includes('econnaborted')) {
        return { category: 'TIMEOUT', message: error.message }
      }
      if (
        message.includes('econnrefused') ||
        message.includes('enotfound') ||
        message.includes('fetch failed')
      ) {
        return { category: 'CONNECTION', message: error.message }
      }
      if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
        return { category: 'AUTH', message: error.message }
      }
      if (message.includes('404')) {
        return { category: 'NOT_FOUND', message: error.message }
      }
      if (message.includes('429') || message.includes('rate limit')) {
        return { category: 'RATE_LIMIT', message: error.message }
      }
      if (message.includes('500') || message.includes('502') || message.includes('503')) {
        return { category: 'SERVER_ERROR', message: error.message }
      }

      return { category: 'UNKNOWN', message: error.message }
    }

    return { category: 'UNKNOWN', message: 'Unknown error' }
  }

  /**
   * Sync only draw metadata (status, close_time) without processing matches
   * Used outside active betting window to detect new coupons with minimal API usage
   */
  async syncDrawMetadataOnly(gameType: GameType = DEFAULT_GAME_TYPE): Promise<{
    success: boolean
    drawsProcessed: number
    error?: string
  }> {
    try {
      console.log(`[Draw Sync] Starting metadata-only sync for ${gameType}...`)

      const apiClient = createApiClient(gameType)
      const { draws } = await apiClient.fetchCurrentDraws()

      if (!draws || draws.length === 0) {
        console.log(`[Draw Sync] No ${gameType} draws returned from API`)
        return { success: true, drawsProcessed: 0 }
      }

      let drawsProcessed = 0

      for (const drawData of draws) {
        try {
          await prisma.draws.upsert({
            where: {
              game_type_draw_number: {
                game_type: gameType,
                draw_number: drawData.drawNumber,
              },
            },
            update: {
              status: drawData.drawState,
              close_time: new Date(drawData.regCloseTime),
              updated_at: new Date(),
            },
            create: {
              draw_number: drawData.drawNumber,
              game_type: gameType,
              draw_date: drawData.drawDate
                ? new Date(drawData.drawDate)
                : new Date(drawData.regCloseTime),
              close_time: new Date(drawData.regCloseTime),
              status: drawData.drawState,
              product_id: drawData.productId,
              raw_data: drawData as unknown as Prisma.InputJsonValue,
            },
          })
          drawsProcessed++
        } catch (error) {
          console.warn(
            `[Draw Sync] Error updating metadata for ${gameType} draw ${drawData.drawNumber}:`,
            error
          )
        }
      }

      console.log(
        `[Draw Sync] Metadata-only sync complete: ${drawsProcessed} ${gameType} draws updated`
      )
      return { success: true, drawsProcessed }
    } catch (error) {
      const { category, message } = this.categorizeError(error)
      console.error(
        `[Draw Sync] Error in metadata-only sync for ${gameType} [${category}]:`,
        message
      )
      return {
        success: false,
        drawsProcessed: 0,
        error: `[${category}] ${message}`,
      }
    }
  }

  /**
   * Sync current draws from API
   */
  async syncCurrentDraws(gameType: GameType = DEFAULT_GAME_TYPE): Promise<{
    success: boolean
    drawsProcessed: number
    matchesProcessed: number
    error?: string
  }> {
    try {
      console.log(`[Draw Sync] Starting sync of current ${gameType} draws...`)

      const apiClient = createApiClient(gameType)
      const { draws } = await apiClient.fetchCurrentDraws()

      if (!draws || draws.length === 0) {
        console.warn(`[Draw Sync] No ${gameType} draws returned from API`)
        return {
          success: true,
          drawsProcessed: 0,
          matchesProcessed: 0,
        }
      }

      let drawsProcessed = 0
      let matchesProcessed = 0
      const errors: string[] = []

      for (const drawData of draws) {
        const result = await this.processDraw(drawData, gameType)
        if (result.success) {
          drawsProcessed++
          matchesProcessed += result.matchesProcessed
        } else {
          errors.push(`Draw ${drawData.drawNumber}: ${result.error}`)
        }
      }

      const totalDraws = draws.length
      console.log(
        `[Draw Sync] Sync complete: ${drawsProcessed}/${totalDraws} ${gameType} draws, ${matchesProcessed} matches`
      )

      if (errors.length > 0) {
        console.warn(`[Draw Sync] Encountered ${errors.length} errors during sync:`, errors)
      }

      // Return success if at least some draws were processed
      return {
        success: drawsProcessed > 0,
        drawsProcessed,
        matchesProcessed,
        error: errors.length > 0 ? `Partial success: ${errors.length} draws failed` : undefined,
      }
    } catch (error) {
      const { category, message } = this.categorizeError(error)
      console.error(`[Draw Sync] Error syncing current ${gameType} draws [${category}]:`, message)
      return {
        success: false,
        drawsProcessed: 0,
        matchesProcessed: 0,
        error: `[${category}] ${message}`,
      }
    }
  }

  /**
   * Sync a specific historic draw
   */
  async syncHistoricDraw(
    drawNumber: number,
    gameType: GameType = DEFAULT_GAME_TYPE
  ): Promise<{ success: boolean; matchesProcessed: number; error?: string }> {
    try {
      console.log(`[Draw Sync] Syncing historic ${gameType} draw ${drawNumber}...`)

      const apiClient = createApiClient(gameType)
      const { draw } = await apiClient.fetchHistoricDraw(drawNumber)
      const result = await this.processDraw(draw, gameType)

      if (result.success) {
        console.log(
          `[Draw Sync] Successfully synced historic ${gameType} draw ${drawNumber} with ${result.matchesProcessed} matches`
        )
      }

      return {
        success: result.success,
        matchesProcessed: result.matchesProcessed,
        error: result.error,
      }
    } catch (error) {
      const { category, message } = this.categorizeError(error)
      console.error(
        `[Draw Sync] Error syncing historic ${gameType} draw ${drawNumber} [${category}]:`,
        message
      )
      return {
        success: false,
        matchesProcessed: 0,
        error: `[${category}] ${message}`,
      }
    }
  }

  /**
   * Upsert a team and return actual DB ID
   */
  private async upsertTeam(participant: ParticipantData): Promise<number> {
    if (!participant?.id || !participant?.name) {
      throw new Error('Missing team ID or name')
    }

    const result = await prisma.teams.upsert({
      where: { name: participant.name },
      update: {
        short_name: participant.shortName || null,
        medium_name: participant.mediumName || null,
        updated_at: new Date(),
      },
      create: {
        id: participant.id,
        name: participant.name,
        short_name: participant.shortName || null,
        medium_name: participant.mediumName || null,
      },
    })

    return result.id // Return actual DB ID, not API ID
  }

  /**
   * Ensure unknown country exists within a transaction
   */
  private async ensureUnknownCountryTx(tx: Prisma.TransactionClient): Promise<number> {
    const UNKNOWN_COUNTRY_ID = 99999

    await tx.countries.upsert({
      where: { id: UNKNOWN_COUNTRY_ID },
      update: {},
      create: {
        id: UNKNOWN_COUNTRY_ID,
        name: 'Unknown',
        iso_code: null,
      },
    })

    return UNKNOWN_COUNTRY_ID
  }

  /**
   * Upsert a country within a transaction and return its ID
   */
  private async upsertCountryTx(
    tx: Prisma.TransactionClient,
    countryData: string | CountryData
  ): Promise<number | null> {
    let countryId: number | null = null
    let countryName: string | null = null

    if (typeof countryData === 'string') {
      return null
    } else if (typeof countryData === 'object' && countryData.id) {
      countryId = countryData.id
      countryName = countryData.name
    }

    if (!countryId || !countryName) return null

    const result = await tx.countries.upsert({
      where: { name: countryName },
      update: {
        iso_code: countryData.isoCode || null,
        updated_at: new Date(),
      },
      create: {
        id: countryId,
        name: countryName,
        iso_code: countryData.isoCode || null,
      },
    })

    return result.id // Return actual DB ID, not API ID
  }

  /**
   * Find an existing country by name or create a new one (transaction-aware)
   */
  private async findOrCreateCountryByNameTx(
    tx: Prisma.TransactionClient,
    name: string,
    isoCode?: string
  ): Promise<number> {
    // Try to find existing country by name
    const existing = await tx.countries.findUnique({
      where: { name },
    })

    if (existing) {
      return existing.id
    }

    // If not found, generate a new ID and create
    const maxCountry = await tx.countries.findFirst({
      orderBy: { id: 'desc' },
      where: { id: { lt: 99999 } }, // Exclude the Unknown country
    })
    const newId = (maxCountry?.id || 0) + 1

    const created = await tx.countries.create({
      data: {
        id: newId,
        name,
        iso_code: isoCode || null,
      },
    })

    console.log(`[Draw Sync] Created new country: ${name} (ID: ${newId})`)
    return created.id
  }

  /**
   * Use AI to infer the country from league and team context (transaction-aware)
   */
  private async inferCountryFromContextTx(
    tx: Prisma.TransactionClient,
    leagueName: string,
    homeTeam?: string,
    awayTeam?: string
  ): Promise<number | null> {
    try {
      const anthropic = new Anthropic()

      const prompt = `Given this sports league/match context, identify the country where this league operates:
League: ${leagueName}
${homeTeam ? `Home Team: ${homeTeam}` : ''}
${awayTeam ? `Away Team: ${awayTeam}` : ''}

Respond with JSON only: {"country": "CountryName", "isoCode": "XX"}
If you cannot determine the country with confidence, respond: {"country": null}`

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      })

      const content = response.content[0]
      if (content && content.type === 'text') {
        const result = JSON.parse((content as { type: 'text'; text: string }).text)
        if (result.country) {
          console.log(
            `[Draw Sync] AI inferred country "${result.country}" for league "${leagueName}"`
          )
          return await this.findOrCreateCountryByNameTx(tx, result.country, result.isoCode)
        }
      }
    } catch (error) {
      console.warn('[Draw Sync] AI country inference failed:', error)
    }
    return null
  }

  /**
   * Upsert a league with AI-powered country inference and return actual DB ID
   */
  private async upsertLeague(
    leagueData: LeagueData,
    homeTeam?: string,
    awayTeam?: string
  ): Promise<number> {
    if (!leagueData?.id || !leagueData?.name) {
      throw new Error('Missing league ID or name')
    }

    return await prisma.$transaction(async tx => {
      let countryId: number | null = null

      // 1. Try extracting country from league data
      if (typeof leagueData.country === 'object' && leagueData.country?.id) {
        countryId = await this.upsertCountryTx(tx, leagueData.country)
      } else if (leagueData.countryId) {
        const existingCountry = await tx.countries.findUnique({
          where: { id: leagueData.countryId },
        })
        if (existingCountry) {
          countryId = leagueData.countryId
        }
      }

      // 2. If no country found, try AI inference (inside transaction)
      if (!countryId) {
        countryId = await this.inferCountryFromContextTx(tx, leagueData.name, homeTeam, awayTeam)
      }

      // 3. Final fallback to Unknown country
      if (!countryId) {
        countryId = await this.ensureUnknownCountryTx(tx)
      }

      const result = await tx.leagues.upsert({
        where: { id: leagueData.id },
        update: {
          name: leagueData.name,
          country_id: countryId,
          updated_at: new Date(),
        },
        create: {
          id: leagueData.id,
          name: leagueData.name,
          country_id: countryId,
        },
      })

      return result.id // Return actual DB ID
    })
  }

  /**
   * Process raw draw data (public wrapper for use by backfill service)
   */
  async processDrawData(
    drawData: DrawData,
    gameType: GameType = DEFAULT_GAME_TYPE
  ): Promise<{ success: boolean; matchesProcessed: number; error?: string }> {
    return this.processDraw(drawData, gameType)
  }

  /**
   * Process a single draw and its matches
   */
  private async processDraw(
    drawData: DrawData,
    gameType: GameType
  ): Promise<{ success: boolean; matchesProcessed: number; error?: string }> {
    try {
      // Upsert draw with game_type
      const draw = await prisma.draws.upsert({
        where: {
          game_type_draw_number: {
            game_type: gameType,
            draw_number: drawData.drawNumber,
          },
        },
        update: {
          status: drawData.drawState,
          close_time: new Date(drawData.regCloseTime),
          net_sale: drawData.currentNetSale
            ? parseFloat(drawData.currentNetSale.replace(',', ''))
            : null,
          raw_data: drawData as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
        create: {
          draw_number: drawData.drawNumber,
          game_type: gameType,
          draw_date: drawData.drawDate
            ? new Date(drawData.drawDate)
            : new Date(drawData.regCloseTime),
          close_time: new Date(drawData.regCloseTime),
          status: drawData.drawState,
          net_sale: drawData.currentNetSale
            ? parseFloat(drawData.currentNetSale.replace(',', ''))
            : null,
          product_id: drawData.productId,
          raw_data: drawData as unknown as Prisma.InputJsonValue,
        },
      })

      // Process matches with individual error tracking
      let matchesProcessed = 0
      const matchErrors: { matchNumber: number; error: string }[] = []

      if (drawData.drawEvents && drawData.drawEvents.length > 0) {
        for (const event of drawData.drawEvents) {
          try {
            await this.processMatch(draw.id, event, gameType)
            matchesProcessed++

            // Clear any previous failed_game record for this match on success
            await failedGamesService.deleteFailedGame(draw.id, event.eventNumber)
          } catch (matchError) {
            const errorMessage = matchError instanceof Error ? matchError.message : 'Unknown error'
            console.warn(
              `[Draw Sync] Error processing match ${event.eventNumber} in ${gameType} draw ${drawData.drawNumber}:`,
              errorMessage
            )

            // Record the failed game
            await failedGamesService.recordFailedGame(
              draw.id,
              event.eventNumber,
              gameType,
              'api_error',
              errorMessage,
              { drawNumber: drawData.drawNumber, matchId: event.match?.matchId }
            )

            matchErrors.push({ matchNumber: event.eventNumber, error: errorMessage })
          }
        }
      }

      // Log if some matches failed
      if (matchErrors.length > 0) {
        console.warn(
          `[Draw Sync] ${gameType} draw ${drawData.drawNumber}: ${matchesProcessed} matches processed, ${matchErrors.length} failed`
        )
      }

      // Enrich matches with API-Football data (runs asynchronously, non-blocking)
      // This maps teams/leagues to API-Football IDs for enhanced data fetching
      this.enrichDrawMatches(draw.id).catch(err => {
        console.warn(`[Draw Sync] Background enrichment failed for draw ${draw.id}:`, err)
      })

      // Calculate statistical metrics for predictions (runs asynchronously, non-blocking)
      // This includes Dixon-Coles probabilities, Elo ratings, form metrics, and EV calculations
      this.calculateStatistics(draw.id).catch(err => {
        console.warn(
          `[Draw Sync] Background statistics calculation failed for draw ${draw.id}:`,
          err
        )
      })

      return { success: true, matchesProcessed }
    } catch (error) {
      console.error(`[Draw Sync] Error processing ${gameType} draw ${drawData.drawNumber}:`, error)
      return {
        success: false,
        matchesProcessed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Process a single match
   */
  private async processMatch(
    drawId: number,
    event: DrawEventData,
    gameType: GameType
  ): Promise<void> {
    const matchData = event.match

    // Extract team names - participants can have type 'home'/'away' or just be ordered
    const homeParticipant =
      matchData.participants.find(p => p.type === 'home') || matchData.participants[0]
    const awayParticipant =
      matchData.participants.find(p => p.type === 'away') || matchData.participants[1]

    if (!homeParticipant?.id || !awayParticipant?.id) {
      throw new Error(
        `Missing team IDs for match ${matchData.matchId}: home=${homeParticipant?.id}, away=${awayParticipant?.id}`
      )
    }

    if (!matchData.league?.id) {
      throw new Error(`Missing league ID for match ${matchData.matchId}`)
    }

    // Upsert teams and get actual DB IDs
    const homeTeamId = await this.upsertTeam(homeParticipant)
    const awayTeamId = await this.upsertTeam(awayParticipant)

    // Upsert league and get actual DB ID (handles country internally with AI inference fallback)
    const leagueId = await this.upsertLeague(
      matchData.league,
      homeParticipant.name,
      awayParticipant.name
    )

    // Extract result if available
    let resultHome = null
    let resultAway = null
    let outcome = null

    if (matchData.result && matchData.result.length > 0) {
      const result = matchData.result[0]
      if (result) {
        // Convert to integer if string
        resultHome = typeof result.home === 'string' ? parseInt(result.home, 10) : result.home
        resultAway = typeof result.away === 'string' ? parseInt(result.away, 10) : result.away

        // Determine outcome
        if (resultHome > resultAway) outcome = '1'
        else if (resultHome < resultAway) outcome = '2'
        else outcome = 'X'
      }
    }

    // Upsert match
    const match = await prisma.matches.upsert({
      where: {
        draw_id_match_number: {
          draw_id: drawId,
          match_number: event.eventNumber,
        },
      },
      update: {
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        league_id: leagueId,
        status: matchData.status,
        status_time: matchData.statusTime ? new Date(matchData.statusTime) : null,
        result_home: resultHome,
        result_away: resultAway,
        outcome,
        coverage: matchData.coverage ?? null,
        betRadar_id:
          matchData.providerIds?.find((p: ProviderIdData) => p.provider === 'BetRadar')?.id ?? null,
        kambi_id:
          matchData.providerIds?.find((p: ProviderIdData) => p.provider === 'Kambi')?.id ?? null,
        raw_data: matchData as unknown as Prisma.InputJsonValue,
        updated_at: new Date(),
      },
      create: {
        draw_id: drawId,
        match_number: event.eventNumber,
        match_id: matchData.matchId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        league_id: leagueId,
        start_time: new Date(matchData.matchStart),
        status: matchData.status,
        status_time: matchData.statusTime ? new Date(matchData.statusTime) : null,
        result_home: resultHome,
        result_away: resultAway,
        outcome,
        coverage: matchData.coverage ?? null,
        betRadar_id:
          matchData.providerIds?.find((p: ProviderIdData) => p.provider === 'BetRadar')?.id ?? null,
        kambi_id:
          matchData.providerIds?.find((p: ProviderIdData) => p.provider === 'Kambi')?.id ?? null,
        raw_data: matchData as unknown as Prisma.InputJsonValue,
      },
    })

    // Update team ratings if match has a final result
    if (resultHome !== null && resultAway !== null && matchData.status === 'FT') {
      this.updateTeamRatings(match.id).catch(err => {
        console.warn(`[Draw Sync] Background rating update failed for match ${match.id}:`, err)
      })

      // Check if this completes the draw (all matches have results)
      this.checkAndArchiveCompletedDraw(drawId, gameType).catch(err => {
        console.warn(`[Draw Sync] Background draw completion check failed for draw ${drawId}:`, err)
      })
    }

    // Process odds if available
    if (event.odds || event.startOdds || event.favouriteOdds || event.betMetrics) {
      await this.processMatchOdds(match.id, event, gameType)
    }

    // Store expert tips if available
    if (event.tioTidningarsTips) {
      await this.storeExpertTips(match.id, event.tioTidningarsTips)
    }

    // Store bet metrics if available
    if (event.betMetrics) {
      await this.storeBetMetrics(match.id, event.betMetrics)
    }

    // Store Svenska Folket detailed data if available
    if (event.svenskaFolket && (event.svenskaFolket.date || event.svenskaFolket.refOne)) {
      await this.storeSvenskaFolketData(match.id, event.svenskaFolket)
    }
  }

  /**
   * Store expert tips (Tio Tidningars Tips) as scraped data
   */
  private async storeExpertTips(matchId: number, tips: ExpertTipsData): Promise<void> {
    try {
      await prisma.match_scraped_data.upsert({
        where: {
          match_id_data_type: {
            match_id: matchId,
            data_type: 'expertTips',
          },
        },
        update: {
          data: tips as unknown as Prisma.InputJsonValue,
          scraped_at: new Date(),
        },
        create: {
          match_id: matchId,
          data_type: 'expertTips',
          data: tips as unknown as Prisma.InputJsonValue,
        },
      })
    } catch (error) {
      console.warn('[Draw Sync] Error storing expert tips:', error)
    }
  }

  /**
   * Store bet metrics (comprehensive betting distribution data)
   */
  private async storeBetMetrics(matchId: number, metrics: BetMetricsData): Promise<void> {
    try {
      await prisma.match_scraped_data.upsert({
        where: {
          match_id_data_type: {
            match_id: matchId,
            data_type: 'betMetrics',
          },
        },
        update: {
          data: metrics as unknown as Prisma.InputJsonValue,
          scraped_at: new Date(),
        },
        create: {
          match_id: matchId,
          data_type: 'betMetrics',
          data: metrics as unknown as Prisma.InputJsonValue,
        },
      })
    } catch (error) {
      console.warn('[Draw Sync] Error storing bet metrics:', error)
    }
  }

  /**
   * Store complete Svenska Folket data with timestamps and references
   */
  private async storeSvenskaFolketData(matchId: number, data: SvenskaFolketData): Promise<void> {
    try {
      await prisma.match_scraped_data.upsert({
        where: {
          match_id_data_type: {
            match_id: matchId,
            data_type: 'svenskaFolket',
          },
        },
        update: {
          data: data as unknown as Prisma.InputJsonValue,
          scraped_at: new Date(),
        },
        create: {
          match_id: matchId,
          data_type: 'svenskaFolket',
          data: data as unknown as Prisma.InputJsonValue,
        },
      })
    } catch (error) {
      console.warn('[Draw Sync] Error storing Svenska Folket data:', error)
    }
  }

  /**
   * Update team Elo ratings after a match completes
   * Runs in background to not block the sync process
   */
  private async updateTeamRatings(matchId: number): Promise<void> {
    try {
      const result = await updateRatingsForCompletedMatch(matchId)
      if (result) {
        console.log(
          `[Draw Sync] Updated ratings for match ${matchId}: ` +
            `home=${result.home.elo.toFixed(0)}, away=${result.away.elo.toFixed(0)}`
        )
      }
    } catch (error) {
      console.warn(`[Draw Sync] Error updating ratings for match ${matchId}:`, error)
    }
  }

  /**
   * Check if a draw is complete (all matches have results) and archive it
   * Runs in background after each match result is synced
   */
  private async checkAndArchiveCompletedDraw(drawId: number, gameType: GameType): Promise<void> {
    try {
      // Get draw info
      const draw = await prisma.draws.findUnique({
        where: { id: drawId },
        select: { draw_number: true, is_current: true },
      })

      if (!draw || !draw.is_current) {
        return // Draw not found or already archived
      }

      // Check if all matches have results
      const isComplete = await drawLifecycle.checkDrawCompletion(drawId)
      if (!isComplete) {
        return // Not all matches have results yet
      }

      console.log(
        `[Draw Sync] Draw ${draw.draw_number} (${gameType}) has all match results - archiving...`
      )

      // Archive the draw (sets status to Completed and is_current to false)
      const success = await drawLifecycle.archiveDraw(draw.draw_number, gameType)
      if (success) {
        // Invalidate cache to reflect archived state
        drawCacheService.invalidateDrawCache(draw.draw_number, gameType)
        drawCacheService.invalidateCurrentDrawsCache(gameType)
        console.log(`[Draw Sync] Draw ${draw.draw_number} (${gameType}) archived successfully`)
      }
    } catch (error) {
      console.warn(`[Draw Sync] Error checking/archiving draw ${drawId}:`, error)
    }
  }

  /**
   * Process match odds - stores start odds, current odds, and favourite odds separately
   */
  private async processMatchOdds(
    matchId: number,
    event: DrawEventData,
    gameType: GameType
  ): Promise<void> {
    const parseSwedishFloat = (value: string | undefined) =>
      value ? parseFloat(value.replace(',', '.')) : NaN

    const processAndStoreOdds = async (
      oddsData: OddsData1X2 | null | undefined,
      type: 'current' | 'start' | 'favourite',
      collectedAt: Date
    ) => {
      if (!oddsData) return

      const homeOdds = parseSwedishFloat(oddsData.one)
      const drawOdds = parseSwedishFloat(oddsData.x)
      const awayOdds = parseSwedishFloat(oddsData.two)

      if (isNaN(homeOdds) || isNaN(drawOdds) || isNaN(awayOdds)) {
        console.warn(`[Draw Sync] Invalid ${type} odds data for match ${matchId}:`, oddsData)
        return
      }

      const totalImplied = 1 / homeOdds + 1 / drawOdds + 1 / awayOdds
      const homeProb = (1 / homeOdds / totalImplied) * 100
      const drawProb = (1 / drawOdds / totalImplied) * 100
      const awayProb = (1 / awayOdds / totalImplied) * 100

      // Svenska Folket data
      const svenskaFolketHome = event.svenskaFolket?.one
      const svenskaFolketDraw = event.svenskaFolket?.x
      const svenskaFolketAway = event.svenskaFolket?.two

      // Tio Tidningars Tips data (convert numbers to strings)
      const tioTipsHome = event.tioTidningarsTips?.one?.toString()
      const tioTipsDraw = event.tioTidningarsTips?.x?.toString()
      const tioTipsAway = event.tioTidningarsTips?.two?.toString()

      await prisma.match_odds.upsert({
        where: {
          match_id_source_type_collected_at: {
            match_id: matchId,
            source: gameType, // Use game type as source
            type: type,
            collected_at: collectedAt,
          },
        },
        update: {
          home_odds: homeOdds,
          draw_odds: drawOdds,
          away_odds: awayOdds,
          home_probability: homeProb,
          draw_probability: drawProb,
          away_probability: awayProb,
          svenska_folket_home: svenskaFolketHome,
          svenska_folket_draw: svenskaFolketDraw,
          svenska_folket_away: svenskaFolketAway,
          tio_tidningars_tips_home: tioTipsHome,
          tio_tidningars_tips_draw: tioTipsDraw,
          tio_tidningars_tips_away: tioTipsAway,
        },
        create: {
          match_id: matchId,
          source: gameType, // Use game type as source
          type: type,
          home_odds: homeOdds,
          draw_odds: drawOdds,
          away_odds: awayOdds,
          home_probability: homeProb,
          draw_probability: drawProb,
          away_probability: awayProb,
          svenska_folket_home: svenskaFolketHome,
          svenska_folket_draw: svenskaFolketDraw,
          svenska_folket_away: svenskaFolketAway,
          tio_tidningars_tips_home: tioTipsHome,
          tio_tidningars_tips_draw: tioTipsDraw,
          tio_tidningars_tips_away: tioTipsAway,
          collected_at: collectedAt,
        },
      })
    }

    // Use slightly different timestamps for each odds type to prevent collision
    // even if database constraint is misconfigured (defensive programming)
    const baseTime = new Date()
    if (event.odds) {
      await processAndStoreOdds(event.odds, 'current', baseTime)
    }
    if (event.startOdds) {
      // Add 1ms offset for start odds
      const startTime = new Date(baseTime.getTime() + 1)
      await processAndStoreOdds(event.startOdds, 'start', startTime)
    }
    if (event.favouriteOdds) {
      // Add 2ms offset for favourite odds
      const favouriteTime = new Date(baseTime.getTime() + 2)
      await processAndStoreOdds(event.favouriteOdds, 'favourite', favouriteTime)
    }
  }

  /**
   * Enrich draw matches with API-Football data
   * Maps teams and leagues to API-Football IDs for enhanced data fetching
   */
  private async enrichDrawMatches(drawId: number): Promise<void> {
    try {
      const enrichmentService = getMatchEnrichmentService()
      const result = await enrichmentService.enrichDraw(drawId)

      console.log(
        `[Draw Sync] Enrichment complete for draw ${drawId}: ${result.successful}/${result.total} matches mapped`
      )
    } catch (error) {
      console.warn(`[Draw Sync] Error enriching draw ${drawId}:`, error)
    }
  }

  /**
   * Calculate statistical metrics for all matches in a draw
   * Includes Dixon-Coles probabilities, Elo ratings, form metrics, and EV calculations
   * Skips matches that already have calculations (unless data has changed)
   */
  private async calculateStatistics(drawId: number): Promise<void> {
    try {
      const result = await recalculateDrawStatistics(drawId)

      console.log(
        `[Draw Sync] Statistics calculation complete for draw ${drawId}: ` +
          `${result.calculated} calculated, ${result.skipped} skipped, ${result.failed} failed`
      )
    } catch (error) {
      console.warn(`[Draw Sync] Error calculating statistics for draw ${drawId}:`, error)
    }
  }
}

// Export singleton instance
export const drawSyncService = new DrawSyncService()
