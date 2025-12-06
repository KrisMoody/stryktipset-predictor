import { scraperServiceV2 } from '~/server/services/scraper/scraper-service-v2'
import { getScraperServiceV3 } from '~/server/services/scraper/scraper-service-v3'

export default defineEventHandler(async event => {
  try {
    const config = useRuntimeConfig()
    const matchId = parseInt(event.context.params?.id || '0')
    const body = await readBody(event)

    // Get match details
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: { draws: true },
    })

    if (!match) {
      throw createError({
        statusCode: 404,
        message: `Match ${matchId} not found`,
      })
    }

    const dataTypes = body.dataTypes || ['xStats', 'statistics', 'headToHead', 'news']

    // Feature flag: Use V3 (AI + DOM) or V2 (DOM only)
    const useV3 = config.enableScraperV3
    const scraperService = useV3
      ? getScraperServiceV3(config.enableAiScraper, config.aiScraperUrl)
      : scraperServiceV2

    console.log(
      `[Scrape API] Using ${useV3 ? 'ScraperServiceV3 (AI+DOM)' : 'ScraperServiceV2 (DOM only)'}`
    )
    if (useV3) {
      console.log(`[Scrape API] AI Scraper enabled: ${config.enableAiScraper}`)
      console.log(`[Scrape API] AI Scraper URL: ${config.aiScraperUrl}`)
    }

    const results = await scraperService.scrapeMatch({
      matchId,
      drawNumber: match.draws.draw_number,
      matchNumber: match.match_number,
      dataTypes,
    })

    return {
      success: true,
      results,
      scraperVersion: useV3 ? 'v3' : 'v2',
    }
  } catch (error) {
    console.error('Error scraping match:', error)
    throw error
  }
})
