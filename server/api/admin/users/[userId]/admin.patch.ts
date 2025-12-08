import { costCapService } from '~/server/services/cost-cap-service'
import { requireAdmin } from '~/server/utils/require-admin'
import { getAuthenticatedUser } from '~/server/utils/get-authenticated-user'

interface SetAdminRequest {
  isAdmin: boolean
}

/**
 * PATCH /api/admin/users/:userId/admin
 * Set a user's admin status (admin only)
 */
export default defineEventHandler(async event => {
  await requireAdmin(event)

  const caller = await getAuthenticatedUser(event)
  const targetUserId = event.context.params?.userId
  if (!targetUserId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required',
    })
  }

  // Prevent admin from removing their own admin status
  if (targetUserId === caller.id) {
    throw createError({
      statusCode: 400,
      message: 'Cannot change your own admin status',
    })
  }

  const body = await readBody<SetAdminRequest>(event)
  if (typeof body.isAdmin !== 'boolean') {
    throw createError({
      statusCode: 400,
      message: 'Valid isAdmin (boolean) is required',
    })
  }

  await costCapService.setUserAdminStatus(targetUserId, body.isAdmin)

  return {
    success: true,
    message: body.isAdmin ? 'User is now an admin' : 'Admin status removed',
  }
})
