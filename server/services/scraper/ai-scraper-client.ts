/**
 * Node.js client for AI Scraper Service
 * Communicates with the Python FastAPI service running Crawl4AI + Claude
 */

interface TokenUsage {
  input: number
  output: number
}

interface AIScraperResult {
  success: boolean
  data: unknown
  tokens: TokenUsage | null
  error: string | null
}

export class AIScraperClient {
  private baseUrl: string
  private timeout: number

  constructor(baseUrl = 'http://localhost:8000') {
    this.baseUrl = baseUrl
    this.timeout = 60000 // 60 seconds - must be longer than Python crawler timeout (45s) + retry delay
  }

  /**
   * Scrape data using AI extraction
   */
  async scrape(url: string, dataType: string): Promise<AIScraperResult> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          data_type: dataType,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`AI Scraper returned ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      return result as AIScraperResult
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          data: null,
          tokens: null,
          error: 'Request timeout',
        }
      }

      return {
        success: false,
        data: null,
        tokens: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Check if AI Scraper service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return false
      }

      const health = await response.json()
      return health.status === 'ok'
    } catch {
      return false
    }
  }
}

// Export factory function to create instance with custom URL
export function getAIScraperClient(baseUrl: string): AIScraperClient {
  return new AIScraperClient(baseUrl)
}

// For backward compatibility, export a default instance
export const aiScraperClient = new AIScraperClient()
