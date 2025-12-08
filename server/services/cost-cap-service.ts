import { prisma } from '~/server/utils/prisma'
import { createLogger } from '~/server/utils/logger'
import { captureOperationError } from '~/server/utils/bugsnag-helpers'

const logger = createLogger('CostCapService')

export interface UserProfile {
  id: number
  userId: string | null // null for pending invites
  email: string
  isAdmin: boolean
  costCapUsd: number
  capBypassUntil: Date | null
  invitedBy: string | null
  invitedAt: Date | null
  disabledAt: Date | null
  disabledBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CostCapCheckResult {
  allowed: boolean
  reason: string
  currentSpending: number
  capAmount: number
  remainingBudget: number
  isAdmin: boolean
  hasBypass: boolean
  bypassExpiresAt?: Date
}

export interface UserProfileWithSpending extends UserProfile {
  currentWeekSpending: number
  remainingBudget: number
}

export interface UserProfileWithExtendedSpending extends UserProfileWithSpending {
  thirtyDaySpending: number
  allTimeSpending: number
}

class CostCapService {
  /**
   * Get the start of the current week (Monday 00:00 UTC)
   */
  getWeekStart(): Date {
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    // Convert Sunday (0) to 7, then calculate days since Monday
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() - daysSinceMonday)
    weekStart.setUTCHours(0, 0, 0, 0)

    return weekStart
  }

  /**
   * Get or create a user profile from Supabase user ID
   */
  async getOrCreateUserProfile(userId: string, email: string): Promise<UserProfile> {
    try {
      let profile = await prisma.user_profiles.findUnique({
        where: { user_id: userId },
      })

      if (!profile) {
        logger.info('Creating new user profile', { userId, email })
        profile = await prisma.user_profiles.create({
          data: {
            user_id: userId,
            email,
            is_admin: false,
            cost_cap_usd: 1.0, // Default $1/week
          },
        })
      }

      return this.mapProfile(profile)
    } catch (error) {
      logger.error('Failed to get or create user profile', error, { userId, email })

      captureOperationError(error, {
        operation: 'cost_cap',
        service: 'cost-cap-service',
        metadata: { action: 'getOrCreateUserProfile', userId, email },
      })

      throw error
    }
  }

  /**
   * Get user profile by ID (returns null if not found)
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const profile = await prisma.user_profiles.findUnique({
      where: { user_id: userId },
    })

    return profile ? this.mapProfile(profile) : null
  }

  /**
   * Get user's AI spending for the current week
   */
  async getCurrentWeekSpending(userId: string): Promise<number> {
    const weekStart = this.getWeekStart()

    const result = await prisma.ai_usage.aggregate({
      where: {
        user_id: userId,
        timestamp: { gte: weekStart },
        success: true, // Only count successful operations
      },
      _sum: {
        cost_usd: true,
      },
    })

    return Number(result._sum.cost_usd || 0)
  }

  /**
   * Get user's AI spending for the last 30 days
   */
  async getThirtyDaySpending(userId: string): Promise<number> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const result = await prisma.ai_usage.aggregate({
      where: {
        user_id: userId,
        timestamp: { gte: thirtyDaysAgo },
        success: true,
      },
      _sum: {
        cost_usd: true,
      },
    })

    return Number(result._sum.cost_usd || 0)
  }

  /**
   * Get user's all-time AI spending
   */
  async getAllTimeSpending(userId: string): Promise<number> {
    const result = await prisma.ai_usage.aggregate({
      where: {
        user_id: userId,
        success: true,
      },
      _sum: {
        cost_usd: true,
      },
    })

    return Number(result._sum.cost_usd || 0)
  }

  /**
   * Check if user can perform AI operations (predictions, scraping)
   */
  async checkUserCostCap(userId: string, email?: string): Promise<CostCapCheckResult> {
    // Get or create profile
    const profile = email
      ? await this.getOrCreateUserProfile(userId, email)
      : await this.getUserProfile(userId)

    if (!profile) {
      return {
        allowed: false,
        reason: 'User profile not found',
        currentSpending: 0,
        capAmount: 0,
        remainingBudget: 0,
        isAdmin: false,
        hasBypass: false,
      }
    }

    // Admins are always allowed
    if (profile.isAdmin) {
      return {
        allowed: true,
        reason: 'Admin user - no cost cap',
        currentSpending: 0,
        capAmount: 0,
        remainingBudget: Infinity,
        isAdmin: true,
        hasBypass: false,
      }
    }

    // Check for active bypass
    const now = new Date()
    const hasBypass = profile.capBypassUntil !== null && profile.capBypassUntil > now

    if (hasBypass) {
      return {
        allowed: true,
        reason: 'Temporary bypass active',
        currentSpending: 0,
        capAmount: profile.costCapUsd,
        remainingBudget: Infinity,
        isAdmin: false,
        hasBypass: true,
        bypassExpiresAt: profile.capBypassUntil!,
      }
    }

    // Calculate current spending
    const currentSpending = await this.getCurrentWeekSpending(userId)
    const remainingBudget = Math.max(0, profile.costCapUsd - currentSpending)
    const allowed = currentSpending < profile.costCapUsd

    return {
      allowed,
      reason: allowed
        ? `Within budget: $${currentSpending.toFixed(4)} of $${profile.costCapUsd.toFixed(2)}`
        : `Weekly budget exceeded: $${currentSpending.toFixed(4)} >= $${profile.costCapUsd.toFixed(2)}`,
      currentSpending,
      capAmount: profile.costCapUsd,
      remainingBudget,
      isAdmin: false,
      hasBypass: false,
    }
  }

  /**
   * Check if user is admin
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    const profile = await prisma.user_profiles.findUnique({
      where: { user_id: userId },
      select: { is_admin: true },
    })

    return profile?.is_admin ?? false
  }

  /**
   * Set temporary bypass for a user (admin function)
   */
  async setTemporaryBypass(userId: string, durationHours: number): Promise<void> {
    const bypassUntil = new Date()
    bypassUntil.setHours(bypassUntil.getHours() + durationHours)

    await prisma.user_profiles.update({
      where: { user_id: userId },
      data: { cap_bypass_until: bypassUntil },
    })

    logger.info('Set temporary bypass', { userId, durationHours, bypassUntil })
  }

  /**
   * Clear temporary bypass for a user (admin function)
   */
  async clearBypass(userId: string): Promise<void> {
    await prisma.user_profiles.update({
      where: { user_id: userId },
      data: { cap_bypass_until: null },
    })

    logger.info('Cleared bypass', { userId })
  }

  /**
   * Update user's cost cap (admin function)
   */
  async updateUserCostCap(userId: string, newCapUsd: number): Promise<void> {
    await prisma.user_profiles.update({
      where: { user_id: userId },
      data: { cost_cap_usd: newCapUsd },
    })

    logger.info('Updated cost cap', { userId, newCapUsd })
  }

  /**
   * Set user admin status (admin function)
   */
  async setUserAdminStatus(userId: string, isAdmin: boolean): Promise<void> {
    await prisma.user_profiles.update({
      where: { user_id: userId },
      data: { is_admin: isAdmin },
    })

    logger.info('Updated admin status', { userId, isAdmin })
  }

  /**
   * Disable a user (admin function)
   */
  async disableUser(userId: string, disabledByUserId: string): Promise<void> {
    await prisma.user_profiles.update({
      where: { user_id: userId },
      data: {
        disabled_at: new Date(),
        disabled_by: disabledByUserId,
        cap_bypass_until: null, // Clear any active bypass
      },
    })

    logger.info('Disabled user', { userId, disabledBy: disabledByUserId })
  }

  /**
   * Enable a user (admin function)
   */
  async enableUser(userId: string): Promise<void> {
    await prisma.user_profiles.update({
      where: { user_id: userId },
      data: {
        disabled_at: null,
        disabled_by: null,
      },
    })

    logger.info('Enabled user', { userId })
  }

  /**
   * Create a user profile for an invited user (admin function)
   * The user_id will be null until the user accepts the invite and logs in
   */
  async createInvitedUserProfile(email: string, invitedByUserId: string): Promise<UserProfile> {
    const profile = await prisma.user_profiles.create({
      data: {
        user_id: null, // Will be set when user accepts invite
        email,
        is_admin: false,
        cost_cap_usd: 1.0,
        invited_by: invitedByUserId,
        invited_at: new Date(),
      },
    })

    logger.info('Created invited user profile', { email, invitedBy: invitedByUserId })

    return this.mapProfile(profile)
  }

  /**
   * Check if user profile exists by email
   */
  async getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    const profile = await prisma.user_profiles.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    })

    return profile ? this.mapProfile(profile) : null
  }

  /**
   * Check if a user is disabled
   */
  async isUserDisabled(userId: string): Promise<boolean> {
    const profile = await prisma.user_profiles.findUnique({
      where: { user_id: userId },
      select: { disabled_at: true },
    })

    return profile?.disabled_at !== null
  }

  /**
   * Get all user profiles with their current week spending (admin function)
   */
  async getAllUsersWithSpending(): Promise<UserProfileWithSpending[]> {
    const profiles = await prisma.user_profiles.findMany({
      orderBy: { created_at: 'desc' },
    })

    const weekStart = this.getWeekStart()

    // Get spending for all users in one query
    const spendingByUser = await prisma.ai_usage.groupBy({
      by: ['user_id'],
      where: {
        user_id: { not: null },
        timestamp: { gte: weekStart },
        success: true,
      },
      _sum: {
        cost_usd: true,
      },
    })

    const spendingMap = new Map(spendingByUser.map(s => [s.user_id, Number(s._sum.cost_usd || 0)]))

    return profiles.map(profile => {
      const mapped = this.mapProfile(profile)
      const currentWeekSpending = spendingMap.get(profile.user_id) || 0
      return {
        ...mapped,
        currentWeekSpending,
        remainingBudget: mapped.isAdmin
          ? Infinity
          : Math.max(0, mapped.costCapUsd - currentWeekSpending),
      }
    })
  }

  /**
   * Get all user profiles with extended spending data (admin function)
   */
  async getAllUsersWithExtendedSpending(): Promise<UserProfileWithExtendedSpending[]> {
    const profiles = await prisma.user_profiles.findMany({
      orderBy: { created_at: 'desc' },
    })

    const weekStart = this.getWeekStart()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Get weekly spending for all users
    const weeklySpendingByUser = await prisma.ai_usage.groupBy({
      by: ['user_id'],
      where: {
        user_id: { not: null },
        timestamp: { gte: weekStart },
        success: true,
      },
      _sum: { cost_usd: true },
    })

    // Get 30-day spending for all users
    const thirtyDaySpendingByUser = await prisma.ai_usage.groupBy({
      by: ['user_id'],
      where: {
        user_id: { not: null },
        timestamp: { gte: thirtyDaysAgo },
        success: true,
      },
      _sum: { cost_usd: true },
    })

    // Get all-time spending for all users
    const allTimeSpendingByUser = await prisma.ai_usage.groupBy({
      by: ['user_id'],
      where: {
        user_id: { not: null },
        success: true,
      },
      _sum: { cost_usd: true },
    })

    const weeklyMap = new Map(
      weeklySpendingByUser.map(s => [s.user_id, Number(s._sum.cost_usd || 0)])
    )
    const thirtyDayMap = new Map(
      thirtyDaySpendingByUser.map(s => [s.user_id, Number(s._sum.cost_usd || 0)])
    )
    const allTimeMap = new Map(
      allTimeSpendingByUser.map(s => [s.user_id, Number(s._sum.cost_usd || 0)])
    )

    return profiles.map(profile => {
      const mapped = this.mapProfile(profile)
      const currentWeekSpending = weeklyMap.get(profile.user_id) || 0
      return {
        ...mapped,
        currentWeekSpending,
        remainingBudget: mapped.isAdmin
          ? Infinity
          : Math.max(0, mapped.costCapUsd - currentWeekSpending),
        thirtyDaySpending: thirtyDayMap.get(profile.user_id) || 0,
        allTimeSpending: allTimeMap.get(profile.user_id) || 0,
      }
    })
  }

  /**
   * Map database profile to interface
   */
  private mapProfile(profile: {
    id: number
    user_id: string | null
    email: string
    is_admin: boolean
    cost_cap_usd: unknown
    cap_bypass_until: Date | null
    invited_by: string | null
    invited_at: Date | null
    disabled_at: Date | null
    disabled_by: string | null
    created_at: Date
    updated_at: Date
  }): UserProfile {
    return {
      id: profile.id,
      userId: profile.user_id,
      email: profile.email,
      isAdmin: profile.is_admin,
      costCapUsd: Number(profile.cost_cap_usd),
      capBypassUntil: profile.cap_bypass_until,
      invitedBy: profile.invited_by,
      invitedAt: profile.invited_at,
      disabledAt: profile.disabled_at,
      disabledBy: profile.disabled_by,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    }
  }
}

export const costCapService = new CostCapService()
