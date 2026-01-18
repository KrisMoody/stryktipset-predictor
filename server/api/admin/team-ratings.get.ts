import { prisma } from '~/server/utils/prisma'

/**
 * GET /api/admin/team-ratings
 * Returns all team ratings for admin management
 * Query params:
 *   - confidence: 'low' | 'medium' | 'high' - filter by confidence level
 *   - limit: number - max results (default 100)
 *   - offset: number - pagination offset
 */
export default defineEventHandler(async event => {
  const query = getQuery(event)
  const confidence = query.confidence as string | undefined
  const limit = Math.min(parseInt(query.limit as string) || 100, 500)
  const offset = parseInt(query.offset as string) || 0

  // Build where clause for Elo ratings (primary rating)
  const whereClause: {
    rating_type: string
    model_version: string
    confidence?: string
  } = {
    rating_type: 'elo',
    model_version: 'v1.0',
  }

  if (confidence && ['low', 'medium', 'high'].includes(confidence)) {
    whereClause.confidence = confidence
  }

  // Get total count
  const totalCount = await prisma.team_ratings.count({
    where: whereClause,
  })

  // Fetch Elo ratings with team info
  const eloRatings = await prisma.team_ratings.findMany({
    where: whereClause,
    include: {
      team: true,
    },
    orderBy: [{ confidence: 'asc' }, { rating_value: 'desc' }],
    take: limit,
    skip: offset,
  })

  // Get attack/defense ratings for these teams
  const teamIds = eloRatings.map(r => r.team_id)
  const otherRatings = await prisma.team_ratings.findMany({
    where: {
      team_id: { in: teamIds },
      rating_type: { in: ['attack', 'defense'] },
      model_version: 'v1.0',
    },
  })

  // Build attack/defense lookup maps
  const attackMap = new Map<number, number>()
  const defenseMap = new Map<number, number>()
  for (const r of otherRatings) {
    if (r.rating_type === 'attack') {
      attackMap.set(r.team_id, Number(r.rating_value))
    } else {
      defenseMap.set(r.team_id, Number(r.rating_value))
    }
  }

  // Transform to response format
  const teams = eloRatings.map(r => ({
    teamId: r.team_id,
    teamName: r.team.name,
    shortName: r.team.short_name,
    elo: Number(r.rating_value),
    attack: attackMap.get(r.team_id) ?? 1.0,
    defense: defenseMap.get(r.team_id) ?? 1.0,
    matchesPlayed: r.matches_played,
    confidence: r.confidence,
    lastMatchDate: r.last_match_date,
    updatedAt: r.updated_at,
  }))

  // Calculate summary stats
  const confidenceCounts = {
    low: teams.filter(t => t.confidence === 'low').length,
    medium: teams.filter(t => t.confidence === 'medium').length,
    high: teams.filter(t => t.confidence === 'high').length,
  }

  return {
    success: true,
    data: {
      teams,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + teams.length < totalCount,
      },
      summary: {
        totalTeams: totalCount,
        confidenceCounts,
        avgElo: teams.length > 0 ? teams.reduce((sum, t) => sum + t.elo, 0) / teams.length : 0,
      },
    },
  }
})
