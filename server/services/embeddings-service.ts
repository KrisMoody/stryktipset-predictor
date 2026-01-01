import { prisma } from '~/server/utils/prisma'
import { OpenAI } from 'openai'
import { recordAIUsage } from '~/server/utils/ai-usage-recorder'
import { calculateAICost } from '~/server/constants/ai-pricing'

/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAI API and Prisma JSON fields */

/**
 * Service for generating and managing vector embeddings for similarity search
 */
export class EmbeddingsService {
  private openai: OpenAI | null = null
  private apiKeyChecked = false

  /**
   * Lazily initialize and return OpenAI client
   * Returns null if API key is not configured (graceful degradation)
   */
  private getOpenAIClient(): OpenAI | null {
    if (!this.apiKeyChecked) {
      this.apiKeyChecked = true
      const apiKey = useRuntimeConfig().openaiApiKey
      if (!apiKey) {
        console.warn(
          '[Embeddings] OpenAI API key not configured - embeddings functionality disabled'
        )
        return null
      }
      this.openai = new OpenAI({ apiKey })
    }
    return this.openai
  }

  /**
   * Generate embedding for a match
   */
  async generateMatchEmbedding(matchId: number): Promise<void> {
    const startTime = Date.now()
    try {
      const openai = this.getOpenAIClient()
      if (!openai) {
        console.log(
          `[Embeddings] Skipping embedding generation for match ${matchId} - OpenAI client not available`
        )
        return
      }

      console.log(`[Embeddings] Generating embedding for match ${matchId}`)

      // Fetch match data
      const match = await prisma.matches.findUnique({
        where: { id: matchId },
        include: {
          draws: true,
          homeTeam: true,
          awayTeam: true,
          league: {
            include: {
              country: true,
            },
          },
          match_odds: {
            where: { type: 'current' },
            orderBy: { collected_at: 'desc' },
            take: 1,
          },
          match_scraped_data: true,
        },
      })

      if (!match) {
        throw new Error(`Match ${matchId} not found`)
      }

      // Create text representation of match
      const matchText = this.createMatchText(match)

      // Generate embedding using OpenAI
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: matchText,
        encoding_format: 'float',
      })

      const embeddingData = response.data[0]
      if (!embeddingData) {
        throw new Error('No embedding data returned from OpenAI')
      }
      const embedding = embeddingData.embedding

      // Track token usage and cost
      const inputTokens = response.usage?.total_tokens || 0
      const cost = calculateAICost('text-embedding-3-small', inputTokens, 0)
      const duration = Date.now() - startTime

      // Store embedding in database
      await prisma.$executeRaw`
        INSERT INTO match_embeddings (match_id, embedding, model, version, metadata, created_at)
        VALUES (
          ${matchId},
          ${JSON.stringify(embedding)}::vector,
          'text-embedding-3-small',
          ${new Date().toISOString()},
          ${JSON.stringify({ matchText: matchText.substring(0, 200) })}::jsonb,
          NOW()
        )
        ON CONFLICT (match_id, model, version) 
        DO UPDATE SET
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata,
          created_at = NOW()
      `

      // Record AI usage
      await recordAIUsage({
        model: 'text-embedding-3-small',
        inputTokens,
        outputTokens: 0,
        cost,
        dataType: 'embedding',
        operationId: `match_${matchId}`,
        endpoint: 'embeddings.create',
        duration,
        success: true,
      }).catch(recordError => {
        console.error('[Embeddings] Failed to record AI usage:', recordError)
      })

      console.log(
        `[Embeddings] Successfully generated embedding for match ${matchId} (${inputTokens} tokens, $${cost.toFixed(6)}, ${duration}ms)`
      )
    } catch (error) {
      const duration = Date.now() - startTime
      // Record failed attempt
      await recordAIUsage({
        model: 'text-embedding-3-small',
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        dataType: 'embedding',
        operationId: `match_${matchId}`,
        endpoint: 'embeddings.create',
        duration,
        success: false,
      }).catch(recordError => {
        console.error('[Embeddings] Failed to record AI usage error:', recordError)
      })

      console.error(`[Embeddings] Error generating embedding for match ${matchId}:`, error)
      throw error
    }
  }

  /**
   * Generate embeddings for multiple matches with rate limiting
   * @param matchIds - Array of match IDs to generate embeddings for
   * @param options - Options for batch generation
   */
  async generateBatchEmbeddings(
    matchIds: number[],
    options: { skipExisting?: boolean; delayMs?: number } = {}
  ): Promise<{ success: number; failed: number; skipped: number }> {
    const { skipExisting = true, delayMs = 500 } = options
    let success = 0,
      failed = 0,
      skipped = 0

    const openai = this.getOpenAIClient()
    if (!openai) {
      console.log(`[Embeddings] Skipping batch embedding generation - OpenAI client not available`)
      return { success: 0, failed: 0, skipped: matchIds.length }
    }

    console.log(
      `[Embeddings] Starting batch generation for ${matchIds.length} matches (skipExisting=${skipExisting}, delayMs=${delayMs})`
    )

    for (const matchId of matchIds) {
      // Check if embedding already exists
      if (skipExisting) {
        const existing = await prisma.$queryRaw<any[]>`
          SELECT 1 FROM match_embeddings
          WHERE match_id = ${matchId} AND model = 'text-embedding-3-small'
          LIMIT 1
        `
        if (existing && existing.length > 0) {
          skipped++
          continue
        }
      }

      try {
        await this.generateMatchEmbedding(matchId)
        success++
      } catch (error) {
        console.error(`[Embeddings] Failed to generate for match ${matchId}:`, error)
        failed++
      }

      // Rate limit to avoid API throttling
      if (delayMs > 0 && matchIds.indexOf(matchId) < matchIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }

    console.log(
      `[Embeddings] Batch complete: ${success} success, ${failed} failed, ${skipped} skipped`
    )
    return { success, failed, skipped }
  }

  /**
   * Generate embeddings for all matches in a draw
   * @param drawNumber - The draw number to generate embeddings for
   * @param gameType - The game type (stryktipset, europatipset, topptipset)
   */
  async generateDrawEmbeddings(
    drawNumber: number,
    gameType: string = 'stryktipset'
  ): Promise<{ success: number; failed: number; skipped: number }> {
    const matches = await prisma.matches.findMany({
      where: {
        draws: {
          draw_number: drawNumber,
          game_type: gameType,
        },
      },
      select: { id: true },
    })

    console.log(
      `[Embeddings] Generating embeddings for ${matches.length} matches in ${gameType}#${drawNumber}`
    )
    return this.generateBatchEmbeddings(matches.map(m => m.id))
  }

  /**
   * Find similar matches using vector similarity with recency weighting
   * @param matchId - Target match ID
   * @param limit - Number of similar matches to return
   * @param options - Search options for recency weighting
   */
  async findSimilarMatches(
    matchId: number,
    limit: number = 10,
    options: {
      recencyWeight?: number // 0-1, how much to weight recent matches (default 0.3)
      maxAgeDays?: number // Maximum age of matches to consider (default 365)
    } = {}
  ): Promise<any[]> {
    const { recencyWeight = 0.3, maxAgeDays = 365 } = options

    try {
      console.log(
        `[Embeddings] Finding ${limit} similar matches to ${matchId} (recency weight: ${recencyWeight}, max age: ${maxAgeDays}d)`
      )

      // Get the embedding for the target match
      const targetEmbedding = await prisma.$queryRaw<any[]>`
        SELECT embedding
        FROM match_embeddings
        WHERE match_id = ${matchId}
        AND model = 'text-embedding-3-small'
        ORDER BY created_at DESC
        LIMIT 1
      `

      if (!targetEmbedding || targetEmbedding.length === 0) {
        console.log(`[Embeddings] No embedding found for match ${matchId}`)
        return []
      }

      // Calculate weight factors for SQL
      const similarityWeight = 1 - recencyWeight
      const maxAgeSeconds = maxAgeDays * 86400

      // Find similar matches with recency-weighted scoring
      // Formula: weighted_score = similarity * similarityWeight + recency_score * recencyWeight
      // Where recency_score = 1 - (age_seconds / maxAgeSeconds), clamped to [0, 1]
      const similarMatches = await prisma.$queryRaw<any[]>`
        SELECT
          m.id,
          ht.name as home_team,
          at.name as away_team,
          l.name as league,
          m.start_time,
          m.result_home,
          m.result_away,
          m.outcome,
          d.draw_date,
          d.draw_number,
          1 - (me.embedding <=> ${targetEmbedding[0].embedding}::vector) as similarity,
          GREATEST(0, 1 - EXTRACT(EPOCH FROM (NOW() - d.draw_date)) / ${maxAgeSeconds}) as recency_score,
          (
            (1 - (me.embedding <=> ${targetEmbedding[0].embedding}::vector)) * ${similarityWeight}
            + GREATEST(0, 1 - EXTRACT(EPOCH FROM (NOW() - d.draw_date)) / ${maxAgeSeconds}) * ${recencyWeight}
          ) as weighted_score
        FROM match_embeddings me
        JOIN matches m ON me.match_id = m.id
        JOIN draws d ON m.draw_id = d.id
        JOIN teams ht ON m.home_team_id = ht.id
        JOIN teams at ON m.away_team_id = at.id
        JOIN leagues l ON m.league_id = l.id
        WHERE me.match_id != ${matchId}
          AND me.model = 'text-embedding-3-small'
          AND m.outcome IS NOT NULL
          AND d.draw_date >= NOW() - INTERVAL '1 day' * ${maxAgeDays}
        ORDER BY weighted_score DESC
        LIMIT ${limit}
      `

      console.log(`[Embeddings] Found ${similarMatches.length} similar matches`)
      return similarMatches
    } catch (error) {
      console.error(`[Embeddings] Error finding similar matches:`, error)
      return []
    }
  }

  /**
   * Find similar matches by team matchup (using team IDs)
   */
  async findSimilarTeamMatchups(
    homeTeamId: number,
    awayTeamId: number,
    limit: number = 5
  ): Promise<any[]> {
    try {
      console.log(`[Embeddings] Finding similar matchups for team ${homeTeamId} vs ${awayTeamId}`)

      // Find direct matchups
      const directMatchups = await prisma.matches.findMany({
        where: {
          OR: [
            { home_team_id: homeTeamId, away_team_id: awayTeamId },
            { home_team_id: awayTeamId, away_team_id: homeTeamId },
          ],
          outcome: { not: null },
        },
        include: {
          draws: true,
          homeTeam: true,
          awayTeam: true,
          league: {
            include: {
              country: true,
            },
          },
          match_odds: {
            where: { type: 'current' },
            orderBy: { collected_at: 'desc' },
            take: 1,
          },
        },
        orderBy: { start_time: 'desc' },
        take: limit,
      })

      console.log(`[Embeddings] Found ${directMatchups.length} direct matchups`)
      return directMatchups
    } catch (error) {
      console.error(`[Embeddings] Error finding team matchups:`, error)
      return []
    }
  }

  /**
   * Create text representation of match for embedding
   * Includes comprehensive data for better similarity matching
   */
  private createMatchText(match: any): string {
    const parts: string[] = []

    // Basic match info
    parts.push(`Match: ${match.homeTeam.name} vs ${match.awayTeam.name}`)
    parts.push(`League: ${match.league.name || 'Unknown'}`)
    parts.push(`Country: ${match.league.country?.name || 'Unknown'}`)

    // Odds data
    if (match.match_odds && match.match_odds.length > 0) {
      const odds = match.match_odds[0]
      parts.push(`Odds: 1=${odds.home_odds} X=${odds.draw_odds} 2=${odds.away_odds}`)
      parts.push(
        `Market probabilities: Home=${odds.home_probability}% Draw=${odds.draw_probability}% Away=${odds.away_probability}%`
      )

      if (odds.svenska_folket_home) {
        parts.push(
          `Public betting: 1=${odds.svenska_folket_home}% X=${odds.svenska_folket_draw}% 2=${odds.svenska_folket_away}%`
        )
      }
    }

    // Enhanced xStats data with last 5 games and home/away specific
    const xStatsData = match.match_scraped_data?.find((d: any) => d.data_type === 'xStats')
    if (xStatsData?.data) {
      const xStats = xStatsData.data

      // Season stats
      if (xStats.homeTeam?.entireSeason) {
        parts.push(
          `Home Season: xG=${xStats.homeTeam.entireSeason.xg || 'N/A'}, xP=${xStats.homeTeam.entireSeason.xp || 'N/A'}`
        )
      }
      if (xStats.awayTeam?.entireSeason) {
        parts.push(
          `Away Season: xG=${xStats.awayTeam.entireSeason.xg || 'N/A'}, xP=${xStats.awayTeam.entireSeason.xp || 'N/A'}`
        )
      }

      // Last 5 games (more predictive for recent form)
      if (xStats.homeTeam?.last5Games) {
        parts.push(
          `Home Last5: xG=${xStats.homeTeam.last5Games.xg || 'N/A'}, xGA=${xStats.homeTeam.last5Games.xga || 'N/A'}`
        )
      }
      if (xStats.awayTeam?.last5Games) {
        parts.push(
          `Away Last5: xG=${xStats.awayTeam.last5Games.xg || 'N/A'}, xGA=${xStats.awayTeam.last5Games.xga || 'N/A'}`
        )
      }

      // Home/Away specific stats (teams play differently at home vs away)
      if (xStats.homeTeam?.entireSeasonHome) {
        parts.push(`Home (at home): xG=${xStats.homeTeam.entireSeasonHome.xg || 'N/A'}`)
      }
      if (xStats.awayTeam?.entireSeasonAway) {
        parts.push(`Away (away): xG=${xStats.awayTeam.entireSeasonAway.xg || 'N/A'}`)
      }

      // Goal statistics
      if (xStats.goalStats?.home) {
        parts.push(
          `Home goals: avg=${xStats.goalStats.home.avgGoalsScored || 'N/A'}, conceded=${xStats.goalStats.home.avgGoalsConceded || 'N/A'}`
        )
      }
      if (xStats.goalStats?.away) {
        parts.push(
          `Away goals: avg=${xStats.goalStats.away?.avgGoalsScored || 'N/A'}, conceded=${xStats.goalStats.away?.avgGoalsConceded || 'N/A'}`
        )
      }
    }

    // Lineup & Injuries data
    const lineupData = match.match_scraped_data?.find((d: any) => d.data_type === 'lineup')
    if (lineupData?.data) {
      const lineup = lineupData.data

      if (lineup.homeTeam) {
        const unavailableCount = lineup.homeTeam.unavailable?.length || 0
        const formation = lineup.homeTeam.formation || 'Unknown'
        const confirmed = lineup.homeTeam.isConfirmed ? 'Confirmed' : 'Probable'
        parts.push(`Home formation: ${formation} (${confirmed}), ${unavailableCount} unavailable`)

        // List key unavailable players
        if (lineup.homeTeam.unavailable?.length > 0) {
          const injuries = lineup.homeTeam.unavailable
            .slice(0, 3)
            .map((p: any) => `${p.name}(${p.reason || 'out'})`)
            .join(', ')
          parts.push(`Home missing: ${injuries}`)
        }
      }

      if (lineup.awayTeam) {
        const unavailableCount = lineup.awayTeam.unavailable?.length || 0
        const formation = lineup.awayTeam.formation || 'Unknown'
        const confirmed = lineup.awayTeam.isConfirmed ? 'Confirmed' : 'Probable'
        parts.push(`Away formation: ${formation} (${confirmed}), ${unavailableCount} unavailable`)

        if (lineup.awayTeam.unavailable?.length > 0) {
          const injuries = lineup.awayTeam.unavailable
            .slice(0, 3)
            .map((p: any) => `${p.name}(${p.reason || 'out'})`)
            .join(', ')
          parts.push(`Away missing: ${injuries}`)
        }
      }
    }

    // Head-to-Head summary
    const h2hData = match.match_scraped_data?.find((d: any) => d.data_type === 'headToHead')
    if (h2hData?.data?.summary) {
      const h2h = h2hData.data.summary
      parts.push(
        `H2H: ${h2h.homeWins || 0}W-${h2h.draws || 0}D-${h2h.awayWins || 0}L (${h2h.totalMatches || 0} matches)`
      )
    }

    // News/Expert consensus
    const newsData = match.match_scraped_data?.find((d: any) => d.data_type === 'news')
    if (newsData?.data) {
      const news = newsData.data

      // Expert recommendations if available
      if (news.expertAnalysis?.length > 0) {
        const recommendations = news.expertAnalysis
          .map((e: any) => e.recommendation)
          .filter(Boolean)
        if (recommendations.length > 0) {
          let count1 = 0,
            countX = 0,
            count2 = 0
          recommendations.forEach((r: string) => {
            if (r.includes('1')) count1++
            if (r.includes('X')) countX++
            if (r.includes('2')) count2++
          })
          parts.push(`Expert tips: 1=${count1}, X=${countX}, 2=${count2}`)
        }
      }

      // News headlines for semantic context
      if (news.articles?.length > 0) {
        const headlines = news.articles
          .slice(0, 2)
          .map((a: any) => a.title)
          .join('; ')
        parts.push(`News: ${headlines}`)
      }
    }

    // Statistics data
    const statsData = match.match_scraped_data?.find((d: any) => d.data_type === 'statistics')
    if (statsData?.data) {
      const stats = statsData.data
      if (stats.homeTeam) {
        parts.push(`Home position: ${stats.homeTeam.position || 'N/A'}`)
        parts.push(`Home form: ${stats.homeTeam.form?.join('') || 'N/A'}`)
      }
      if (stats.awayTeam) {
        parts.push(`Away position: ${stats.awayTeam.position || 'N/A'}`)
        parts.push(`Away form: ${stats.awayTeam.form?.join('') || 'N/A'}`)
      }
    }

    // Outcome (if available - for historical matches)
    if (match.outcome) {
      parts.push(`Result: ${match.outcome} (${match.result_home}-${match.result_away})`)
    }

    return parts.join('. ')
  }
}

// Export singleton instance
export const embeddingsService = new EmbeddingsService()
