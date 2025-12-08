import { costCapService } from '~/server/services/cost-cap-service'
import { requireAdmin } from '~/server/utils/require-admin'

/**
 * GET /api/admin/users
 * List all users with their current week spending (admin only)
 */
export default defineEventHandler(async event => {
  await requireAdmin(event)

  const users = await costCapService.getAllUsersWithSpending()

  return {
    success: true,
    users: users.map(u => ({
      id: u.id,
      userId: u.userId,
      email: u.email,
      isAdmin: u.isAdmin,
      costCapUsd: u.costCapUsd,
      capBypassUntil: u.capBypassUntil,
      currentWeekSpending: u.currentWeekSpending,
      remainingBudget: u.remainingBudget,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
  }
})
