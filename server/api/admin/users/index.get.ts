import { costCapService } from '~/server/services/cost-cap-service'
import { requireAdmin } from '~/server/utils/require-admin'

/**
 * GET /api/admin/users
 * List all users with their spending data (admin only)
 */
export default defineEventHandler(async event => {
  await requireAdmin(event)

  const users = await costCapService.getAllUsersWithExtendedSpending()

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
      thirtyDaySpending: u.thirtyDaySpending,
      allTimeSpending: u.allTimeSpending,
      remainingBudget: u.remainingBudget,
      invitedBy: u.invitedBy,
      invitedAt: u.invitedAt,
      disabledAt: u.disabledAt,
      disabledBy: u.disabledBy,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
  }
})
