/* eslint-disable @typescript-eslint/no-explicit-any -- Complex API response structures */
import type {
  DrawData,
  MultifetchResponse,
  DrawResultData,
  AvailableDrawsData,
  GameType,
  GameConfig,
} from '~/types'
import { captureOperationError } from '~/server/utils/bugsnag-helpers'
import { getGameConfig, GAME_CONFIGS } from '~/server/constants/game-configs'
import { DEFAULT_GAME_TYPE } from '~/types/game-types'

/**
 * Client for interacting with Svenska Spel API
 * Supports multiple game types: Stryktipset, Europatipset, Topptipset
 */
export class SvenskaSpelApiClient {
  private baseUrl: string
  private multifetchBaseUrl: string
  private gameType: GameType
  private gameConfig: GameConfig

  constructor(gameType: GameType = DEFAULT_GAME_TYPE) {
    this.gameType = gameType
    this.gameConfig = getGameConfig(gameType)
    // Product-specific base URL based on game type
    this.baseUrl = `https://api.spela.svenskaspel.se${this.gameConfig.apiPath}`
    // Multifetch uses the root API domain
    this.multifetchBaseUrl = 'https://api.spela.svenskaspel.se'
  }

  /**
   * Get the current game type
   */
  getGameType(): GameType {
    return this.gameType
  }

  /**
   * Get the current game configuration
   */
  getGameConfig(): GameConfig {
    return this.gameConfig
  }

  /**
   * Get common request headers
   */
  private getHeaders(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://spela.svenskaspel.se/',
      Origin: 'https://spela.svenskaspel.se',
    }
  }

  /**
   * Fetch current/upcoming draws
   */
  async fetchCurrentDraws(): Promise<{ draws: DrawData[] }> {
    // Topptipset has no /draws list endpoint, use hybrid approach
    if (this.gameType === 'topptipset') {
      return this.fetchTopptipsetCurrentDraws()
    }

    try {
      console.log(`[Svenska Spel API] Fetching current ${this.gameConfig.displayName} draws...`)

      const response = await $fetch<{ draws: DrawData[] }>(`${this.baseUrl}/draws`, {
        method: 'GET',
        headers: this.getHeaders(),
        timeout: 30000, // 30 seconds timeout
        retry: 4,
        retryDelay: 2000, // 2 seconds between retries
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
        onRequestError({ error }) {
          console.warn('[Svenska Spel API] Request error:', error.message)
        },
        onResponseError({ response }) {
          console.warn('[Svenska Spel API] Response error:', response.status, response.statusText)
        },
      })

      console.log(
        `[Svenska Spel API] Found ${response.draws?.length || 0} ${this.gameConfig.displayName} draws`
      )
      return response
    } catch (error) {
      console.error(
        `[Svenska Spel API] Error fetching current ${this.gameConfig.displayName} draws:`,
        error
      )

      captureOperationError(error, {
        operation: 'api_call',
        service: 'svenska-spel',
        metadata: { endpoint: 'draws', method: 'GET', gameType: this.gameType },
      })

      throw new Error(`Failed to fetch current ${this.gameConfig.displayName} draws: ${error}`)
    }
  }

  /**
   * Fetch a specific draw by number
   */
  async fetchDrawByNumber(drawNumber: number): Promise<{ draw: DrawData }> {
    try {
      console.log(
        `[Svenska Spel API] Fetching ${this.gameConfig.displayName} draw ${drawNumber}...`
      )

      const response = await $fetch<{ draw: DrawData }>(`${this.baseUrl}/draws/${drawNumber}`, {
        method: 'GET',
        headers: this.getHeaders(),
        timeout: 30000, // 30 seconds timeout
        retry: 4,
        retryDelay: 2000, // 2 seconds between retries
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
        onRequestError({ error }) {
          console.warn(`[Svenska Spel API] Request error for draw ${drawNumber}:`, error.message)
        },
        onResponseError({ response }) {
          console.warn(
            `[Svenska Spel API] Response error for draw ${drawNumber}:`,
            response.status,
            response.statusText
          )
        },
      })

      console.log(
        `[Svenska Spel API] Successfully fetched ${this.gameConfig.displayName} draw ${drawNumber}`
      )
      return response
    } catch (error) {
      console.error(
        `[Svenska Spel API] Error fetching ${this.gameConfig.displayName} draw ${drawNumber}:`,
        error
      )

      captureOperationError(error, {
        operation: 'api_call',
        service: 'svenska-spel',
        metadata: {
          endpoint: `draws/${drawNumber}`,
          method: 'GET',
          drawNumber,
          gameType: this.gameType,
        },
      })

      throw new Error(`Failed to fetch ${this.gameConfig.displayName} draw ${drawNumber}: ${error}`)
    }
  }

  /**
   * Fetch draw using multifetch endpoint with optional jackpot data
   * This is the preferred method for fetching historic draws
   */
  async fetchDrawWithMultifetch(
    drawNumber: number,
    includeJackpot: boolean = true
  ): Promise<{ draw: DrawData; jackpot?: any }> {
    try {
      console.log(
        `[Svenska Spel API] Fetching ${this.gameConfig.displayName} draw ${drawNumber} via multifetch (jackpot: ${includeJackpot})...`
      )

      // Build URLs for multifetch using game-specific API path
      const urls: string[] = [`${this.gameConfig.apiPath}/draws/${drawNumber}`]

      if (includeJackpot) {
        // URL encode the jackpot query parameters
        const jackpotUrl = `/draw/1/jackpot/draws?product=${this.gameConfig.name}&drawNumber=${drawNumber}`
        urls.push(encodeURIComponent(jackpotUrl))
      }

      const urlsParam = urls.join('|')
      const response = await $fetch<MultifetchResponse>(
        `${this.multifetchBaseUrl}/multifetch?urls=${urlsParam}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
          timeout: 30000,
          retry: 4,
          retryDelay: 2000, // 2 seconds between retries
          retryStatusCodes: [408, 429, 500, 502, 503, 504],
          onRequestError({ error }) {
            console.warn(
              `[Svenska Spel API] Multifetch request error for draw ${drawNumber}:`,
              error.message
            )
          },
          onResponseError({ response }) {
            console.warn(
              `[Svenska Spel API] Multifetch response error for draw ${drawNumber}:`,
              response.status,
              response.statusText
            )
          },
        }
      )

      // Extract draw data from first response
      if (!response.responses || response.responses.length === 0) {
        throw new Error('Multifetch returned no responses')
      }

      const drawResponse = response.responses[0]
      if (!drawResponse) {
        throw new Error('Multifetch first response is undefined')
      }

      if (drawResponse.error) {
        throw new Error(`Multifetch error: ${drawResponse.error.message || 'Unknown error'}`)
      }

      if (!drawResponse.draw) {
        throw new Error('Multifetch response missing draw data')
      }

      const result: { draw: DrawData; jackpot?: any } = { draw: drawResponse.draw }

      // Extract jackpot data if requested and available
      if (includeJackpot && response.responses.length > 1) {
        const jackpotResponse = response.responses[1]
        if (jackpotResponse && !jackpotResponse.error && jackpotResponse.jackpot) {
          result.jackpot = jackpotResponse.jackpot
        }
      }

      console.log(
        `[Svenska Spel API] Successfully fetched ${this.gameConfig.displayName} draw ${drawNumber} via multifetch`
      )
      return result
    } catch (error) {
      console.error(
        `[Svenska Spel API] Error fetching ${this.gameConfig.displayName} draw ${drawNumber} via multifetch:`,
        error
      )

      captureOperationError(error, {
        operation: 'api_call',
        service: 'svenska-spel',
        metadata: { endpoint: 'multifetch', method: 'GET', drawNumber, gameType: this.gameType },
      })

      throw new Error(
        `Failed to fetch ${this.gameConfig.displayName} draw ${drawNumber} via multifetch: ${error}`
      )
    }
  }

  /**
   * Fetch multiple draws in a single multifetch request
   * Efficient for batch syncing historic draws
   */
  async fetchMultipleDraws(
    drawNumbers: number[]
  ): Promise<Array<{ drawNumber: number; draw?: DrawData; error?: string }>> {
    try {
      console.log(
        `[Svenska Spel API] Batch fetching ${drawNumbers.length} ${this.gameConfig.displayName} draws via multifetch...`
      )

      if (drawNumbers.length === 0) {
        return []
      }

      // Build URLs for multifetch (pipe-separated) using game-specific API path
      const urls = drawNumbers.map(num => `${this.gameConfig.apiPath}/draws/${num}`).join('|')

      const response = await $fetch<MultifetchResponse>(
        `${this.multifetchBaseUrl}/multifetch?urls=${urls}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
          timeout: 30000,
          retry: 4,
          retryDelay: 2000, // 2 seconds between retries
          retryStatusCodes: [408, 429, 500, 502, 503, 504],
        }
      )

      // Process each response
      const results = drawNumbers.map((drawNumber, index) => {
        const itemResponse = response.responses[index]

        if (!itemResponse) {
          return { drawNumber, error: 'No response received' }
        }

        if (itemResponse.error) {
          return {
            drawNumber,
            error: itemResponse.error.message || 'Unknown error',
          }
        }

        if (!itemResponse.draw) {
          return { drawNumber, error: 'Response missing draw data' }
        }

        return { drawNumber, draw: itemResponse.draw }
      })

      const successCount = results.filter(r => r.draw).length
      console.log(
        `[Svenska Spel API] Batch fetch complete: ${successCount}/${drawNumbers.length} ${this.gameConfig.displayName} draws successful`
      )

      return results
    } catch (error) {
      console.error(
        `[Svenska Spel API] Error in batch multifetch for ${this.gameConfig.displayName}:`,
        error
      )

      captureOperationError(error, {
        operation: 'api_call',
        service: 'svenska-spel',
        metadata: {
          endpoint: 'multifetch-batch',
          method: 'GET',
          drawCount: drawNumbers.length,
          gameType: this.gameType,
        },
      })

      throw new Error(`Failed to batch fetch ${this.gameConfig.displayName} draws: ${error}`)
    }
  }

  /**
   * Fetch detailed result data for a draw (prize distribution, payouts)
   */
  async fetchDrawResult(drawNumber: number): Promise<DrawResultData> {
    try {
      console.log(
        `[Svenska Spel API] Fetching result data for ${this.gameConfig.displayName} draw ${drawNumber}...`
      )

      const response = await $fetch<DrawResultData>(`${this.baseUrl}/draws/${drawNumber}/result`, {
        method: 'GET',
        headers: this.getHeaders(),
        timeout: 30000,
        retry: 4,
        retryDelay: 2000, // 2 seconds between retries
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
      })

      console.log(
        `[Svenska Spel API] Successfully fetched result data for ${this.gameConfig.displayName} draw ${drawNumber}`
      )
      return response
    } catch (error) {
      console.error(
        `[Svenska Spel API] Error fetching result for ${this.gameConfig.displayName} draw ${drawNumber}:`,
        error
      )

      captureOperationError(error, {
        operation: 'api_call',
        service: 'svenska-spel',
        metadata: {
          endpoint: `draws/${drawNumber}/result`,
          method: 'GET',
          drawNumber,
          gameType: this.gameType,
        },
      })

      throw new Error(
        `Failed to fetch result for ${this.gameConfig.displayName} draw ${drawNumber}: ${error}`
      )
    }
  }

  /**
   * Fetch available draws for a given year and month using date picker API
   * Useful for discovering which historic draws exist
   */
  async fetchAvailableDraws(year: number, month: number): Promise<AvailableDrawsData> {
    try {
      console.log(
        `[Svenska Spel API] Fetching available ${this.gameConfig.displayName} draws for ${year}-${month}...`
      )

      const response = await $fetch<any>(
        `${this.multifetchBaseUrl}/draw/1/results/datepicker/?product=${this.gameConfig.name}&year=${year}&month=${month}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
          timeout: 30000,
          retry: 4,
          retryDelay: 2000, // 2 seconds between retries
          retryStatusCodes: [408, 429, 500, 502, 503, 504],
        }
      )

      // API returns resultDates, but we need to map it to draws for consistency
      const draws =
        response.resultDates?.map((result: any) => ({
          date: result.date,
          drawNumber: result.drawNumber,
          product: result.product,
          drawState: result.drawState,
        })) || []

      const drawCount = draws.length
      console.log(
        `[Svenska Spel API] Found ${drawCount} available ${this.gameConfig.displayName} draws for ${year}-${month}`
      )

      return {
        year: response.year,
        month: response.month,
        draws,
      }
    } catch (error: any) {
      // Handle 404 gracefully - future months may not have draws yet
      // Check multiple ways since error structure can vary between ofetch versions/environments
      const is404 =
        error?.statusCode === 404 ||
        error?.status === 404 ||
        error?.response?.status === 404 ||
        error?.data?.error?.code === 404 ||
        (error?.message && error.message.includes('404'))
      if (is404) {
        console.log(
          `[Svenska Spel API] No draws available for ${this.gameConfig.displayName} ${year}-${month} (404)`
        )
        return { year, month, draws: [] }
      }

      console.error(
        `[Svenska Spel API] Error fetching available ${this.gameConfig.displayName} draws for ${year}-${month}:`,
        error
      )

      captureOperationError(error, {
        operation: 'api_call',
        service: 'svenska-spel',
        metadata: { endpoint: 'datepicker', method: 'GET', year, month, gameType: this.gameType },
      })

      throw new Error(
        `Failed to fetch available ${this.gameConfig.displayName} draws for ${year}-${month}: ${error}`
      )
    }
  }

  /**
   * Fetch historic draw with results using multifetch (preferred method)
   */
  async fetchHistoricDraw(drawNumber: number): Promise<{ draw: DrawData }> {
    // Use multifetch for better performance and richer data
    const result = await this.fetchDrawWithMultifetch(drawNumber, true)
    return { draw: result.draw }
  }

  /**
   * Fetch current Topptipset draws using datepicker API
   *
   * Topptipset has no /draws list endpoint, but the datepicker API works
   * and returns draws with their state (Open, Finalized, etc.)
   *
   * We query current and next month to handle month boundaries,
   * then filter for Open draws and fetch each one.
   */
  private async fetchTopptipsetCurrentDraws(): Promise<{ draws: DrawData[] }> {
    try {
      console.log('[Svenska Spel API] Fetching Topptipset draws via datepicker API...')

      // Step 1: Get current and next month for datepicker queries
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1 // 1-indexed

      // Calculate next month (handle year boundary)
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear

      // Step 2: Fetch available draws for current and next month
      const [currentMonthData, nextMonthData] = await Promise.all([
        this.fetchAvailableDraws(currentYear, currentMonth),
        this.fetchAvailableDraws(nextYear, nextMonth),
      ])

      // Step 3: Combine and deduplicate draw numbers, filter for Open state
      const allDraws = [...(currentMonthData.draws || []), ...(nextMonthData.draws || [])]
      const openDrawNumbers = [
        ...new Set(allDraws.filter(d => d.drawState === 'Open').map(d => d.drawNumber)),
      ]

      if (openDrawNumbers.length === 0) {
        console.log('[Svenska Spel API] No open Topptipset draws found')
        return { draws: [] }
      }

      console.log(
        `[Svenska Spel API] Found ${openDrawNumbers.length} open Topptipset draws: ${openDrawNumbers.join(', ')}`
      )

      // Step 4: Fetch each open draw individually with error isolation
      const draws: DrawData[] = []
      const failedDraws: number[] = []

      for (const drawNumber of openDrawNumbers) {
        try {
          const result = await this.fetchDrawWithMultifetch(drawNumber, false)
          draws.push(result.draw)
        } catch (error) {
          console.warn(
            `[Svenska Spel API] Failed to fetch Topptipset draw ${drawNumber}:`,
            error instanceof Error ? error.message : error
          )
          failedDraws.push(drawNumber)
        }
      }

      if (failedDraws.length > 0) {
        console.warn(
          `[Svenska Spel API] ${failedDraws.length}/${openDrawNumbers.length} Topptipset draws failed: ${failedDraws.join(', ')}`
        )
      }

      console.log(
        `[Svenska Spel API] Successfully fetched ${draws.length} Topptipset draws via datepicker API`
      )

      return { draws }
    } catch (error) {
      console.error('[Svenska Spel API] Error fetching Topptipset draws:', error)

      captureOperationError(error, {
        operation: 'api_call',
        service: 'svenska-spel',
        metadata: { endpoint: 'topptipset-datepicker', method: 'GET', gameType: this.gameType },
      })

      throw new Error(`Failed to fetch Topptipset draws: ${error}`)
    }
  }
}

/**
 * Factory function to create a game-specific API client
 * @param gameType - The game type to create a client for
 * @returns A new SvenskaSpelApiClient instance configured for the specified game
 */
export function createApiClient(gameType: GameType = DEFAULT_GAME_TYPE): SvenskaSpelApiClient {
  return new SvenskaSpelApiClient(gameType)
}

/**
 * Get API clients for all supported game types
 * @returns Record of game type to API client
 */
export function getAllApiClients(): Record<GameType, SvenskaSpelApiClient> {
  const clients: Record<GameType, SvenskaSpelApiClient> = {} as any
  for (const gameType of Object.keys(GAME_CONFIGS) as GameType[]) {
    clients[gameType] = new SvenskaSpelApiClient(gameType)
  }
  return clients
}

// Export singleton instance for backward compatibility (defaults to Stryktipset)
export const svenskaSpelApi = new SvenskaSpelApiClient('stryktipset')
