import { scraperServiceV2 } from '~/server/services/scraper/scraper-service-v2'
import { getScraperServiceV3 } from '~/server/services/scraper/scraper-service-v3'
import { getMatchEnrichmentService } from '~/server/services/api-football/match-enrichment'
import { costCapService } from '~/server/services/cost-cap-service'
import { getAuthenticatedUser } from '~/server/utils/get-authenticated-user'
import { prisma } from '~/server/utils/prisma'
import type { GameType } from '~/types/game-types'

export default defineEventHandler(async event => {
  try {
    const config = useRuntimeConfig()
    const matchId = parseInt(event.context.params?.id || '0')
    const body = await readBody(event)

    // Get authenticated user and check cost cap (only for AI scraping)
    const user = await getAuthenticatedUser(event)
    const capCheck = await costCapService.checkUserCostCap(user.id, user.email)

    // Only enforce cost cap if AI scraper is enabled (V3 with AI)
    if (config.enableScraperV3 && config.enableAiScraper && !capCheck.allowed) {
      throw createError({
        statusCode: 403,
        message: capCheck.reason,
        data: {
          currentSpending: capCheck.currentSpending,
          capAmount: capCheck.capAmount,
          remainingBudget: capCheck.remainingBudget,
        },
      })
    }

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

    const dataTypes = body.dataTypes || ['xStats', 'statistics', 'headToHead', 'news', 'lineup']

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

    // Check if API-Football is enabled
    const apiFootballConfig = config.apiFootball as { enabled?: boolean } | undefined
    const enableApiFootball = apiFootballConfig?.enabled === true

    if (enableApiFootball) {
      console.log(`[Scrape API] API-Football enabled, will fetch data in parallel`)
    }

    // Run web scraping and API-Football fetching in parallel
    const [scraperResults, apiFootballResult] = await Promise.all([
      // Web scraping (existing logic)
      scraperService.scrapeMatch({
        matchId,
        drawNumber: match.draws.draw_number,
        matchNumber: match.match_number,
        dataTypes,
        userId: user.id,
        gameType: match.draws.game_type as GameType,
      }),
      // API-Football data fetching (if enabled)
      enableApiFootball
        ? getMatchEnrichmentService()
            .fetchAllDataForMatch(matchId)
            .catch(err => {
              console.warn(`[Scrape API] API-Football fetch failed:`, err)
              return null
            })
        : Promise.resolve(null),
    ])

    return {
      success: true,
      results: scraperResults,
      scraperVersion: useV3 ? 'v3' : 'v2',
      apiFootball: apiFootballResult
        ? {
            enabled: true,
            mapped: apiFootballResult.mapped,
            dataFetched: {
              statistics: apiFootballResult.statistics,
              headToHead: apiFootballResult.headToHead,
              injuries: apiFootballResult.injuries,
            },
            error: apiFootballResult.error,
          }
        : { enabled: false },
    }
  } catch (error) {
    console.error('Error scraping match:', error)
    throw error
  }
})
