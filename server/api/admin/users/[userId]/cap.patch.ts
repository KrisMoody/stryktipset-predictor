import { costCapService } from '~/server/services/cost-cap-service'
import { requireAdmin } from '~/server/utils/require-admin'

interface UpdateCapRequest {
  costCapUsd: number
}

/**
 * PATCH /api/admin/users/:userId/cap
 * Update a user's cost cap (admin only)
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

  const body = await readBody<UpdateCapRequest>(event)
  if (typeof body.costCapUsd !== 'number' || body.costCapUsd < 0) {
    throw createError({
      statusCode: 400,
      message: 'Valid costCapUsd (non-negative number) is required',
    })
  }

  await costCapService.updateUserCostCap(targetUserId, body.costCapUsd)

  return {
    success: true,
    message: `Cost cap updated to $${body.costCapUsd.toFixed(2)}`,
  }
})
