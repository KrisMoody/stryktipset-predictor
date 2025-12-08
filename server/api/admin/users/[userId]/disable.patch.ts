import { requireAdmin } from '~/server/utils/require-admin'
import { getAuthenticatedUser } from '~/server/utils/get-authenticated-user'
import { costCapService } from '~/server/services/cost-cap-service'

/**
 * PATCH /api/admin/users/:userId/disable
 * Disable or enable a user (admin only)
 */
export default defineEventHandler(async event => {
  await requireAdmin(event)

  const userId = getRouterParam(event, 'userId')
  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required',
    })
  }

  const body = await readBody(event)
  const { disabled } = body

  if (typeof disabled !== 'boolean') {
    throw createError({
      statusCode: 400,
      message: 'disabled field must be a boolean',
    })
  }

  // Get the admin user performing the action
  const adminUser = await getAuthenticatedUser(event)

  // Prevent admin from disabling themselves
  if (disabled && adminUser.id === userId) {
    throw createError({
      statusCode: 400,
      message: 'You cannot disable your own account',
    })
  }

  // Check if target user exists
  const targetProfile = await costCapService.getUserProfile(userId)
  if (!targetProfile) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  if (disabled) {
    await costCapService.disableUser(userId, adminUser.id)
  } else {
    await costCapService.enableUser(userId)
  }

  return {
    success: true,
    message: disabled ? 'User has been disabled' : 'User has been enabled',
    userId,
    disabled,
  }
})
