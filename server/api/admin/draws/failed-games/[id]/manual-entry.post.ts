import { requireAdmin } from '~/server/utils/require-admin'
import { getAuthenticatedUser } from '~/server/utils/get-authenticated-user'
import { failedGamesService } from '~/server/services/failed-games-service'
import type { ManualGameEntryData } from '~/types/failed-games'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const user = await getAuthenticatedUser(event)

  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)

  if (isNaN(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      message: 'Invalid failed game ID',
    })
  }

  try {
    const body = await readBody<ManualGameEntryData>(event)

    // Validate required fields
    if (!body.homeTeamName || !body.awayTeamName || !body.leagueName || !body.startTime) {
      return {
        success: false,
        error: 'Missing required fields: homeTeamName, awayTeamName, leagueName, startTime',
      }
    }

    // Get admin user ID from auth
    const adminUserId = user.id

    // Resolve with manual entry
    const result = await failedGamesService.resolveWithManualEntry(id, body, adminUserId)

    return result
  } catch (error) {
    console.error(`[Admin] Error processing manual entry for failed game ${id}:`, error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to process manual entry',
    })
  }
})
