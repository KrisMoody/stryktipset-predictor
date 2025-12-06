/**
 * Historic API client for Svenska Spel
 * Used for one-time backfilling of historic draws
 * Uses standard fetch instead of Nuxt's $fetch for compatibility with CLI scripts
 */

/**
 * Response from the datepicker API
 */
interface DatePickerResponse {
  product: string
  year: number
  month: number
  resultDates: Array<{
    date: string
    drawNumber: number
    product: string
    drawState: string
    drawStateId: number
    openDate: string | null
    closeDate: string
  }>
}

/**
 * Response from multifetch API
 */
interface MultifetchResponse {
  responses: Array<{
    draw?: any
    error?: {
      message: string
      code?: string
    }
  }>
}

/**
 * Client for fetching historic Stryktipset draws
 */
export class SvenskaSpelHistoricApiClient {
  private baseUrl = 'https://api.spela.svenskaspel.se'

  /**
   * Fetch available draws for a specific year/month
   */
  async fetchAvailableDraws(year: number, month: number): Promise<number[]> {
    const url = `${this.baseUrl}/draw/1/results/datepicker/?product=stryktipset&year=${year}&month=${month}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://spela.svenskaspel.se/',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json() as DatePickerResponse

    return data.resultDates?.map(d => d.drawNumber) || []
  }

  /**
   * Fetch multiple draws in a single request
   */
  async fetchMultipleDraws(drawNumbers: number[]): Promise<Array<{ drawNumber: number, draw?: any, error?: string }>> {
    if (drawNumbers.length === 0) {
      return []
    }

    const urls = drawNumbers.map(num => `/draw/1/stryktipset/draws/${num}`).join('|')
    const url = `${this.baseUrl}/multifetch?urls=${urls}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://spela.svenskaspel.se/',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json() as MultifetchResponse

    return drawNumbers.map((drawNumber, index) => {
      const itemResponse = data.responses[index]

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
  }

  /**
   * Fetch a single historic draw
   */
  async fetchHistoricDraw(drawNumber: number): Promise<any> {
    const url = `${this.baseUrl}/draw/1/stryktipset/draws/${drawNumber}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://spela.svenskaspel.se/',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return data.draw
  }
}

// Export singleton instance
export const svenskaSpelHistoricApi = new SvenskaSpelHistoricApiClient()
