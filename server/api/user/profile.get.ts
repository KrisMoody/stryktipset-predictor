import { costCapService } from '~/server/services/cost-cap-service'
import { getAuthenticatedUser } from '~/server/utils/get-authenticated-user'

/**
 * GET /api/user/profile
 * Get the current user's profile including cost cap status
 */
export default defineEventHandler(async event => {
  const user = await getAuthenticatedUser(event)

  // Get or create profile
  const profile = await costCapService.getOrCreateUserProfile(user.id, user.email)

  // Get current spending
  const currentWeekSpending = await costCapService.getCurrentWeekSpending(user.id)
  const remainingBudget = profile.isAdmin
    ? Infinity
    : Math.max(0, profile.costCapUsd - currentWeekSpending)

  // Check for active bypass
  const now = new Date()
  const hasBypass = profile.capBypassUntil !== null && profile.capBypassUntil > now

  return {
    success: true,
    profile: {
      id: profile.id,
      userId: profile.userId,
      email: profile.email,
      isAdmin: profile.isAdmin,
      costCapUsd: profile.costCapUsd,
      capBypassUntil: profile.capBypassUntil,
      currentWeekSpending,
      remainingBudget: profile.isAdmin ? null : remainingBudget, // null for admins (no limit)
      hasBypass,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
  }
})
