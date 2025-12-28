import { requireAdmin } from '~/server/utils/require-admin'
import { prisma } from '~/server/utils/prisma'
import type { ManualGameEntryData } from '~/types/failed-games'

interface ManualMatchBody extends ManualGameEntryData {
  matchNumber: number
}

// Generate negative IDs for manually created entities to avoid conflicts with Svenska Spel IDs
async function getNextManualId(table: 'teams' | 'leagues' | 'countries'): Promise<number> {
  const result = await prisma.$queryRawUnsafe<{ min_id: number | null }[]>(
    `SELECT MIN(id) as min_id FROM ${table}`
  )
  const minId = result[0]?.min_id ?? 0
  // Use negative IDs for manual entries, starting from -1 and going down
  return minId < 0 ? minId - 1 : -1
}

async function findOrCreateCountry(name: string): Promise<number> {
  // Try to find existing country by name
  const existing = await prisma.countries.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  })
  if (existing) return existing.id

  // Create new country with negative ID
  const newId = await getNextManualId('countries')
  const country = await prisma.countries.create({
    data: {
      id: newId,
      name: name,
      iso_code: name.substring(0, 3).toUpperCase(), // Generate a code
    },
  })
  return country.id
}

async function findOrCreateLeague(name: string, countryId: number): Promise<number> {
  // Try to find existing league by name
  const existing = await prisma.leagues.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  })
  if (existing) return existing.id

  // Create new league with negative ID
  const newId = await getNextManualId('leagues')
  const league = await prisma.leagues.create({
    data: {
      id: newId,
      name: name,
      country_id: countryId,
    },
  })
  return league.id
}

async function findOrCreateTeam(name: string): Promise<number> {
  // Try to find existing team by name
  const existing = await prisma.teams.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  })
  if (existing) return existing.id

  // Create new team with negative ID
  const newId = await getNextManualId('teams')
  const team = await prisma.teams.create({
    data: {
      id: newId,
      name: name,
    },
  })
  return team.id
}

export default defineEventHandler(async event => {
  await requireAdmin(event)

  const drawIdParam = getRouterParam(event, 'drawId')
  const drawId = Number(drawIdParam)

  if (isNaN(drawId) || drawId <= 0) {
    throw createError({
      statusCode: 400,
      message: 'Invalid draw ID',
    })
  }

  try {
    const body = await readBody<ManualMatchBody>(event)

    // Validate required fields
    if (!body.homeTeamName || !body.awayTeamName || !body.leagueName || !body.startTime) {
      return {
        success: false,
        error: 'Missing required fields: homeTeamName, awayTeamName, leagueName, startTime',
      }
    }

    if (!body.matchNumber || body.matchNumber <= 0) {
      return {
        success: false,
        error: 'Invalid match number',
      }
    }

    // Verify draw exists
    const draw = await prisma.draws.findUnique({
      where: { id: drawId },
      select: { id: true, draw_number: true, game_type: true },
    })

    if (!draw) {
      return {
        success: false,
        error: 'Draw not found',
      }
    }

    // Check if match already exists
    const existingMatch = await prisma.matches.findUnique({
      where: {
        draw_id_match_number: {
          draw_id: drawId,
          match_number: body.matchNumber,
        },
      },
    })

    if (existingMatch) {
      return {
        success: false,
        error: `Match ${body.matchNumber} already exists for this draw`,
      }
    }

    console.log(`[Admin] Creating manual match ${body.matchNumber} for draw ${draw.draw_number}`)

    // Find or create country
    const countryName = body.countryName || 'Unknown'
    const countryId = await findOrCreateCountry(countryName)

    // Find or create league
    const leagueId = await findOrCreateLeague(body.leagueName, countryId)

    // Find or create teams
    const homeTeamId = await findOrCreateTeam(body.homeTeamName)
    const awayTeamId = await findOrCreateTeam(body.awayTeamName)

    // Generate a unique match_id for manually created matches (negative to avoid conflicts)
    const matchIdResult = await prisma.$queryRaw<{ min_id: number | null }[]>`
      SELECT MIN(match_id) as min_id FROM matches
    `
    const minMatchId = matchIdResult[0]?.min_id ?? 0
    const manualMatchId = minMatchId < 0 ? minMatchId - 1 : -1

    // Create the match
    const match = await prisma.matches.create({
      data: {
        draw_id: drawId,
        match_number: body.matchNumber,
        match_id: manualMatchId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        league_id: leagueId,
        start_time: new Date(body.startTime),
        status: body.status || 'NotStarted',
        raw_data: JSON.parse(
          JSON.stringify({
            manual_entry: true,
            entered_at: new Date().toISOString(),
            original_data: body,
          })
        ),
      },
    })

    console.log(
      `[Admin] Successfully created manual match ${body.matchNumber} (ID: ${match.id}) for draw ${draw.draw_number}`
    )

    return {
      success: true,
      message: `Successfully created match ${body.matchNumber}`,
      matchId: match.id,
      teams: {
        home: { id: homeTeamId, name: body.homeTeamName },
        away: { id: awayTeamId, name: body.awayTeamName },
      },
      league: { id: leagueId, name: body.leagueName },
    }
  } catch (error) {
    console.error(`[Admin] Error creating manual match for draw ${drawId}:`, error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to create match',
    })
  }
})
