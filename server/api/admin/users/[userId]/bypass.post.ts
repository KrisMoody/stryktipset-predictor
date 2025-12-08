import { costCapService } from '~/server/services/cost-cap-service'
import { requireAdmin } from '~/server/utils/require-admin'

interface SetBypassRequest {
  hours: number
}

/**
 * POST /api/admin/users/:userId/bypass
 * Set a temporary cost cap bypass for a user (admin only)
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

  const body = await readBody<SetBypassRequest>(event)
  if (typeof body.hours !== 'number' || body.hours <= 0) {
    throw createError({
      statusCode: 400,
      message: 'Valid hours (positive number) is required',
    })
  }

  await costCapService.setTemporaryBypass(targetUserId, body.hours)

  const bypassUntil = new Date()
  bypassUntil.setHours(bypassUntil.getHours() + body.hours)

  return {
    success: true,
    message: `Bypass set for ${body.hours} hours`,
    bypassUntil,
  }
})
