import { prisma } from '~/server/utils/prisma'
import { createApiClient } from './svenska-spel-api'
import { failedGamesService } from './failed-games-service'
import type { DrawData, DrawEventData, ProviderIdData, GameType } from '~/types'
import { DEFAULT_GAME_TYPE } from '~/types/game-types'

/* eslint-disable @typescript-eslint/no-explicit-any -- Complex API data transformations */

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
              raw_data: drawData as any,
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
   * Upsert a team
   */
  private async upsertTeam(participant: any): Promise<void> {
    if (!participant?.id || !participant?.name) return

    await prisma.teams.upsert({
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
  }

  /**
   * Upsert a country and return its ID
   */
  private async upsertCountry(countryData: any): Promise<number | null> {
    let countryId: number | null = null
    let countryName: string | null = null

    if (typeof countryData === 'string') {
      // If country is just a string, we can't create it without an ID
      return null
    } else if (typeof countryData === 'object' && countryData.id) {
      countryId = countryData.id
      countryName = countryData.name
    }

    if (!countryId || !countryName) return null

    await prisma.countries.upsert({
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

    return countryId
  }

  /**
   * Ensure a fallback "Unknown" country exists for leagues without country data
   */
  private async ensureUnknownCountry(): Promise<number> {
    const UNKNOWN_COUNTRY_ID = 99999

    await prisma.countries.upsert({
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
   * Upsert a league
   */
  private async upsertLeague(leagueData: any): Promise<void> {
    if (!leagueData?.id || !leagueData?.name) return

    // Determine country ID - upsert country first if available
    let countryId: number | null = null

    if (typeof leagueData.country === 'object' && leagueData.country?.id) {
      countryId = await this.upsertCountry(leagueData.country)
    } else if (leagueData.countryId) {
      // Check if this country exists
      const existingCountry = await prisma.countries.findUnique({
        where: { id: leagueData.countryId },
      })
      if (existingCountry) {
        countryId = leagueData.countryId
      }
    }

    // If no valid country, use the Unknown fallback
    if (!countryId) {
      countryId = await this.ensureUnknownCountry()
    }

    await prisma.leagues.upsert({
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
          raw_data: drawData as any,
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
          raw_data: drawData as any,
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

    // Upsert teams
    await this.upsertTeam(homeParticipant)
    await this.upsertTeam(awayParticipant)

    // Upsert league (handles country internally)
    await this.upsertLeague(matchData.league)

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
        home_team_id: homeParticipant.id,
        away_team_id: awayParticipant.id,
        league_id: matchData.league.id,
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
        raw_data: matchData as any,
        updated_at: new Date(),
      },
      create: {
        draw_id: drawId,
        match_number: event.eventNumber,
        match_id: matchData.matchId,
        home_team_id: homeParticipant.id,
        away_team_id: awayParticipant.id,
        league_id: matchData.league.id,
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
        raw_data: matchData as any,
      },
    })

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
  private async storeExpertTips(matchId: number, tips: any): Promise<void> {
    try {
      await prisma.match_scraped_data.upsert({
        where: {
          match_id_data_type: {
            match_id: matchId,
            data_type: 'expertTips',
          },
        },
        update: {
          data: tips as any,
          scraped_at: new Date(),
        },
        create: {
          match_id: matchId,
          data_type: 'expertTips',
          data: tips as any,
        },
      })
    } catch (error) {
      console.warn('[Draw Sync] Error storing expert tips:', error)
    }
  }

  /**
   * Store bet metrics (comprehensive betting distribution data)
   */
  private async storeBetMetrics(matchId: number, metrics: any): Promise<void> {
    try {
      await prisma.match_scraped_data.upsert({
        where: {
          match_id_data_type: {
            match_id: matchId,
            data_type: 'betMetrics',
          },
        },
        update: {
          data: metrics as any,
          scraped_at: new Date(),
        },
        create: {
          match_id: matchId,
          data_type: 'betMetrics',
          data: metrics as any,
        },
      })
    } catch (error) {
      console.warn('[Draw Sync] Error storing bet metrics:', error)
    }
  }

  /**
   * Store complete Svenska Folket data with timestamps and references
   */
  private async storeSvenskaFolketData(matchId: number, data: any): Promise<void> {
    try {
      await prisma.match_scraped_data.upsert({
        where: {
          match_id_data_type: {
            match_id: matchId,
            data_type: 'svenskaFolket',
          },
        },
        update: {
          data: data as any,
          scraped_at: new Date(),
        },
        create: {
          match_id: matchId,
          data_type: 'svenskaFolket',
          data: data as any,
        },
      })
    } catch (error) {
      console.warn('[Draw Sync] Error storing Svenska Folket data:', error)
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
      oddsData: any | null | undefined,
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
}

// Export singleton instance
export const drawSyncService = new DrawSyncService()
