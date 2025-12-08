import type { H3Event } from 'h3'
import { getAuthenticatedUser } from './get-authenticated-user'
import { costCapService } from '~/server/services/cost-cap-service'

/**
 * Require the current user to be an admin.
 * Throws 403 error if not admin, 401 if not authenticated.
 */
export async function requireAdmin(event: H3Event): Promise<void> {
  const user = await getAuthenticatedUser(event)
  const isAdmin = await costCapService.isUserAdmin(user.id)

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }
}
