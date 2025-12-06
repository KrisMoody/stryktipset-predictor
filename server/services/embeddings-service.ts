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
   * Find similar matches using vector similarity
   */
  async findSimilarMatches(matchId: number, limit: number = 10): Promise<any[]> {
    try {
      console.log(`[Embeddings] Finding ${limit} similar matches to ${matchId}`)

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

      // Find similar matches using cosine similarity
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
          1 - (me.embedding <=> ${targetEmbedding[0].embedding}::vector) as similarity
        FROM match_embeddings me
        JOIN matches m ON me.match_id = m.id
        JOIN draws d ON m.draw_id = d.id
        JOIN teams ht ON m.home_team_id = ht.id
        JOIN teams at ON m.away_team_id = at.id
        JOIN leagues l ON m.league_id = l.id
        WHERE me.match_id != ${matchId}
          AND me.model = 'text-embedding-3-small'
          AND m.outcome IS NOT NULL
        ORDER BY me.embedding <=> ${targetEmbedding[0].embedding}::vector
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

    // xStats data
    const xStatsData = match.match_scraped_data?.find((d: any) => d.data_type === 'xStats')
    if (xStatsData?.data) {
      const xStats = xStatsData.data
      if (xStats.homeTeam) {
        parts.push(`Home xG: ${xStats.homeTeam.entireSeason?.xg || 'N/A'}`)
        parts.push(`Home xP: ${xStats.homeTeam.entireSeason?.xp || 'N/A'}`)
      }
      if (xStats.awayTeam) {
        parts.push(`Away xG: ${xStats.awayTeam.entireSeason?.xg || 'N/A'}`)
        parts.push(`Away xP: ${xStats.awayTeam.entireSeason?.xp || 'N/A'}`)
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

    // Outcome (if available)
    if (match.outcome) {
      parts.push(`Result: ${match.outcome} (${match.result_home}-${match.result_away})`)
    }

    return parts.join('. ')
  }
}

// Export singleton instance
export const embeddingsService = new EmbeddingsService()
