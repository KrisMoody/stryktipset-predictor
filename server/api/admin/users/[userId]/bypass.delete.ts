import { costCapService } from '~/server/services/cost-cap-service'
import { requireAdmin } from '~/server/utils/require-admin'

/**
 * DELETE /api/admin/users/:userId/bypass
 * Clear a user's temporary cost cap bypass (admin only)
 */
export default defineEventHandler(async event => {
  await requireAdmin(event)

  const targetUserId = event.context.params?.userId
  if (!targetUserId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required',
    })
  }

  await costCapService.clearBypass(targetUserId)

  return {
    success: true,
    message: 'Bypass cleared',
  }
})
