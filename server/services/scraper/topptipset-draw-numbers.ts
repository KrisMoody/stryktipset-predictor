/**
 * Scrape current Topptipset draw numbers from the page
 *
 * Uses the AI Scraper service (Crawl4AI) for better anti-detection.
 * Since Topptipset doesn't have a /draws list endpoint, we need to
 * extract draw numbers from the embedded _svs.draw.data.draws object.
 *
 * @param aiScraperUrl - URL of the AI scraper service (from runtime config)
 */
export async function scrapeTopptipsetDrawNumbers(aiScraperUrl: string): Promise<number[]> {
  console.log('[Topptipset Scraper] Scraping current draw numbers via Crawl4AI...')

  try {
    const response = await fetch(`${aiScraperUrl}/scrape-raw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://spela.svenskaspel.se/topptipset',
        js_expression: 'window._svs?.draw?.data?.draws',
      }),
    })

    if (!response.ok) {
      throw new Error(`AI Scraper returned ${response.status}: ${await response.text()}`)
    }

    const result = await response.json()

    if (!result.success) {
      console.error('[Topptipset Scraper] Crawl4AI failed:', result.error)
      throw new Error(result.error || 'Failed to scrape page')
    }

    // Extract Topptipset draw numbers from the draws object
    // Topptipset uses multiple product IDs: 23, 24, 25 (different variants/days)
    const draws = result.data
    if (!draws || typeof draws !== 'object') {
      console.warn('[Topptipset Scraper] No draws data returned')
      return []
    }

    // Topptipset product IDs: 23, 24, 25
    const topptipsetProductIds = ['23', '24', '25']

    const drawNumbers = Object.keys(draws)
      .filter(key => topptipsetProductIds.some(id => key.startsWith(`${id}_`)))
      .map(key => {
        const parts = key.split('_')
        return parts[1] ? parseInt(parts[1], 10) : 0
      })
      .filter(num => num > 0)
      .sort((a, b) => b - a) // Most recent first

    console.log(
      `[Topptipset Scraper] Found ${drawNumbers.length} draw numbers: ${drawNumbers.join(', ')}`
    )

    return drawNumbers
  } catch (error) {
    console.error('[Topptipset Scraper] Error scraping draw numbers:', error)
    throw error
  }
}
