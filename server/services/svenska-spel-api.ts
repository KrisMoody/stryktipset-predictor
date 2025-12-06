import type { DrawData, MultifetchResponse, DrawResultData, AvailableDrawsData } from '~/types'

/**
 * Client for interacting with Svenska Spel API
 */
export class SvenskaSpelApiClient {
  private baseUrl: string
  private multifetchBaseUrl: string

  constructor(baseUrl?: string) {
    // Product-specific base URL for Stryktipset
    this.baseUrl = baseUrl || 'https://api.spela.svenskaspel.se/draw/1/stryktipset'
    // Multifetch uses the root API domain
    this.multifetchBaseUrl = 'https://api.spela.svenskaspel.se'
  }

  /**
   * Fetch current/upcoming draws
   */
  async fetchCurrentDraws(): Promise<{ draws: DrawData[] }> {
    try {
      console.log('[Svenska Spel API] Fetching current draws...')

      const response = await $fetch<{ draws: DrawData[] }>(`${this.baseUrl}/draws`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://spela.svenskaspel.se/',
          'Origin': 'https://spela.svenskaspel.se',
        },
        timeout: 30000, // 30 seconds timeout
        retry: 4,
        retryDelay: 1000,
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
        onRequestError({ error }) {
          console.warn('[Svenska Spel API] Request error:', error.message)
        },
        onResponseError({ response }) {
          console.warn('[Svenska Spel API] Response error:', response.status, response.statusText)
        },
      })

      console.log(`[Svenska Spel API] Found ${response.draws?.length || 0} draws`)
      return response
    }
    catch (error) {
      console.error('[Svenska Spel API] Error fetching current draws:', error)
      throw new Error(`Failed to fetch current draws: ${error}`)
    }
  }

  /**
   * Fetch a specific draw by number
   */
  async fetchDrawByNumber(drawNumber: number): Promise<{ draw: DrawData }> {
    try {
      console.log(`[Svenska Spel API] Fetching draw ${drawNumber}...`)

      const response = await $fetch<{ draw: DrawData }>(`${this.baseUrl}/draws/${drawNumber}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://spela.svenskaspel.se/',
          'Origin': 'https://spela.svenskaspel.se',
        },
        timeout: 30000, // 30 seconds timeout
        retry: 4,
        retryDelay: 1000,
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
        onRequestError({ error }) {
          console.warn(`[Svenska Spel API] Request error for draw ${drawNumber}:`, error.message)
        },
        onResponseError({ response }) {
          console.warn(`[Svenska Spel API] Response error for draw ${drawNumber}:`, response.status, response.statusText)
        },
      })

      console.log(`[Svenska Spel API] Successfully fetched draw ${drawNumber}`)
      return response
    }
    catch (error) {
      console.error(`[Svenska Spel API] Error fetching draw ${drawNumber}:`, error)
      throw new Error(`Failed to fetch draw ${drawNumber}: ${error}`)
    }
  }

  /**
   * Fetch draw using multifetch endpoint with optional jackpot data
   * This is the preferred method for fetching historic draws
   */
  async fetchDrawWithMultifetch(drawNumber: number, includeJackpot: boolean = true): Promise<{ draw: DrawData, jackpot?: any }> {
    try {
      console.log(`[Svenska Spel API] Fetching draw ${drawNumber} via multifetch (jackpot: ${includeJackpot})...`)

      // Build URLs for multifetch
      const urls: string[] = [`/draw/1/stryktipset/draws/${drawNumber}`]

      if (includeJackpot) {
        // URL encode the jackpot query parameters
        const jackpotUrl = `/draw/1/jackpot/draws?product=stryktipset&drawNumber=${drawNumber}`
        urls.push(encodeURIComponent(jackpotUrl))
      }

      const urlsParam = urls.join('|')
      const response = await $fetch<MultifetchResponse>(`${this.multifetchBaseUrl}/multifetch?urls=${urlsParam}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://spela.svenskaspel.se/',
          'Origin': 'https://spela.svenskaspel.se',
        },
        timeout: 30000,
        retry: 4,
        retryDelay: 1000,
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
        onRequestError({ error }) {
          console.warn(`[Svenska Spel API] Multifetch request error for draw ${drawNumber}:`, error.message)
        },
        onResponseError({ response }) {
          console.warn(`[Svenska Spel API] Multifetch response error for draw ${drawNumber}:`, response.status, response.statusText)
        },
      })

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

      const result: { draw: DrawData, jackpot?: any } = { draw: drawResponse.draw }

      // Extract jackpot data if requested and available
      if (includeJackpot && response.responses.length > 1) {
        const jackpotResponse = response.responses[1]
        if (jackpotResponse && !jackpotResponse.error && jackpotResponse.jackpot) {
          result.jackpot = jackpotResponse.jackpot
        }
      }

      console.log(`[Svenska Spel API] Successfully fetched draw ${drawNumber} via multifetch`)
      return result
    }
    catch (error) {
      console.error(`[Svenska Spel API] Error fetching draw ${drawNumber} via multifetch:`, error)
      throw new Error(`Failed to fetch draw ${drawNumber} via multifetch: ${error}`)
    }
  }

  /**
   * Fetch multiple draws in a single multifetch request
   * Efficient for batch syncing historic draws
   */
  async fetchMultipleDraws(drawNumbers: number[]): Promise<Array<{ drawNumber: number, draw?: DrawData, error?: string }>> {
    try {
      console.log(`[Svenska Spel API] Batch fetching ${drawNumbers.length} draws via multifetch...`)

      if (drawNumbers.length === 0) {
        return []
      }

      // Build URLs for multifetch (pipe-separated)
      const urls = drawNumbers.map(num => `/draw/1/stryktipset/draws/${num}`).join('|')

      const response = await $fetch<MultifetchResponse>(`${this.multifetchBaseUrl}/multifetch?urls=${urls}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://spela.svenskaspel.se/',
          'Origin': 'https://spela.svenskaspel.se',
        },
        timeout: 30000,
        retry: 4,
        retryDelay: 1000,
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
      })

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
      console.log(`[Svenska Spel API] Batch fetch complete: ${successCount}/${drawNumbers.length} successful`)

      return results
    }
    catch (error) {
      console.error(`[Svenska Spel API] Error in batch multifetch:`, error)
      throw new Error(`Failed to batch fetch draws: ${error}`)
    }
  }

  /**
   * Fetch detailed result data for a draw (prize distribution, payouts)
   */
  async fetchDrawResult(drawNumber: number): Promise<DrawResultData> {
    try {
      console.log(`[Svenska Spel API] Fetching result data for draw ${drawNumber}...`)

      const response = await $fetch<DrawResultData>(`${this.baseUrl}/draws/${drawNumber}/result`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://spela.svenskaspel.se/',
          'Origin': 'https://spela.svenskaspel.se',
        },
        timeout: 30000,
        retry: 4,
        retryDelay: 1000,
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
      })

      console.log(`[Svenska Spel API] Successfully fetched result data for draw ${drawNumber}`)
      return response
    }
    catch (error) {
      console.error(`[Svenska Spel API] Error fetching result for draw ${drawNumber}:`, error)
      throw new Error(`Failed to fetch result for draw ${drawNumber}: ${error}`)
    }
  }

  /**
   * Fetch available draws for a given year and month using date picker API
   * Useful for discovering which historic draws exist
   */
  async fetchAvailableDraws(year: number, month: number): Promise<AvailableDrawsData> {
    try {
      console.log(`[Svenska Spel API] Fetching available draws for ${year}-${month}...`)

      const response = await $fetch<any>(
        `${this.multifetchBaseUrl}/draw/1/results/datepicker/?product=stryktipset&year=${year}&month=${month}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://spela.svenskaspel.se/',
            'Origin': 'https://spela.svenskaspel.se',
          },
          timeout: 30000,
          retry: 4,
          retryDelay: 1000,
          retryStatusCodes: [408, 429, 500, 502, 503, 504],
        },
      )

      // API returns resultDates, but we need to map it to draws for consistency
      const draws = response.resultDates?.map((result: any) => ({
        date: result.date,
        drawNumber: result.drawNumber,
        product: result.product,
        drawState: result.drawState,
      })) || []

      const drawCount = draws.length
      console.log(`[Svenska Spel API] Found ${drawCount} available draws for ${year}-${month}`)

      return {
        year: response.year,
        month: response.month,
        draws,
      }
    }
    catch (error) {
      console.error(`[Svenska Spel API] Error fetching available draws for ${year}-${month}:`, error)
      throw new Error(`Failed to fetch available draws: ${error}`)
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
}

// Export singleton instance
export const svenskaSpelApi = new SvenskaSpelApiClient()
