import { prisma } from '~/server/utils/prisma'

/**
 * GET /api/teams/:id/ratings
 * Returns team Elo, attack, and defense ratings
 */
export default defineEventHandler(async event => {
  const teamId = parseInt(event.context.params?.id || '0')

  if (!teamId || isNaN(teamId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid team ID',
    })
  }

  const team = await prisma.teams.findUnique({
    where: { id: teamId },
    include: {
      team_ratings: {
        where: { model_version: 'v1.0' },
      },
    },
  })

  if (!team) {
    throw createError({
      statusCode: 404,
      message: 'Team not found',
    })
  }

  const elo = team.team_ratings.find(r => r.rating_type === 'elo')
  const attack = team.team_ratings.find(r => r.rating_type === 'attack')
  const defense = team.team_ratings.find(r => r.rating_type === 'defense')

  if (!elo) {
    return {
      success: true,
      data: null,
      message: 'No rating data available for this team',
    }
  }

  return {
    success: true,
    data: {
      teamId: team.id,
      teamName: team.name,
      elo: Number(elo.rating_value),
      attack: attack ? Number(attack.rating_value) : 1.0,
      defense: defense ? Number(defense.rating_value) : 1.0,
      matchesPlayed: elo.matches_played,
      confidence: elo.confidence,
      lastMatchDate: elo.last_match_date,
      modelVersion: elo.model_version,
      updatedAt: elo.updated_at,
    },
  }
})
