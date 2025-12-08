import { requireAdmin } from '~/server/utils/require-admin'
import { prisma } from '~/server/utils/prisma'

/**
 * DELETE /api/admin/users/:userId/invite
 * Delete a pending invitation (admin only)
 * Note: userId here is actually the profile ID (numeric) for pending users
 */
export default defineEventHandler(async event => {
  await requireAdmin(event)

  const profileId = getRouterParam(event, 'userId')
  if (!profileId) {
    throw createError({
      statusCode: 400,
      message: 'Profile ID is required',
    })
  }

  const id = parseInt(profileId, 10)
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid profile ID',
    })
  }

  // Find the profile
  const profile = await prisma.user_profiles.findUnique({
    where: { id },
  })

  if (!profile) {
    throw createError({
      statusCode: 404,
      message: 'Invitation not found',
    })
  }

  // Only allow deletion of pending invitations (user_id is null)
  if (profile.user_id !== null) {
    throw createError({
      statusCode: 400,
      message: 'Cannot delete - user has already accepted the invitation',
    })
  }

  // Delete the profile
  await prisma.user_profiles.delete({
    where: { id },
  })

  return {
    success: true,
    message: 'Invitation deleted',
    email: profile.email,
  }
})
