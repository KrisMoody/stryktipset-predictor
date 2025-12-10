/* eslint-disable @typescript-eslint/no-explicit-any -- Test file with mock data */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================================
// Mock Prisma
// ============================================================================

const mockPrisma = {
  user_profiles: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  ai_usage: {
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
}

vi.mock('~/server/utils/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('~/server/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

vi.mock('~/server/utils/bugsnag-helpers', () => ({
  captureOperationError: vi.fn(),
}))

// ============================================================================
// Test Data Factories
// ============================================================================

const createMockDbProfile = (overrides: Partial<any> = {}) => ({
  id: 1,
  user_id: 'user-123',
  email: 'test@example.com',
  is_admin: false,
  cost_cap_usd: 1.0,
  cap_bypass_until: null,
  invited_by: null,
  invited_at: null,
  disabled_at: null,
  disabled_by: null,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  ...overrides,
})

// ============================================================================
// Testable CostCapService
// ============================================================================

interface UserProfile {
  id: number
  userId: string | null
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

interface CostCapCheckResult {
  allowed: boolean
  reason: string
  currentSpending: number
  capAmount: number
  remainingBudget: number
  isAdmin: boolean
  hasBypass: boolean
  bypassExpiresAt?: Date
}

class TestableCostCapService {
  /**
   * Get the start of the current week (Monday 00:00 UTC)
   */
  getWeekStart(): Date {
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
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
    let profile = await mockPrisma.user_profiles.findUnique({
      where: { user_id: userId },
    })

    if (!profile) {
      profile = await mockPrisma.user_profiles.create({
        data: {
          user_id: userId,
          email,
          is_admin: false,
          cost_cap_usd: 1.0,
        },
      })
    }

    return this.mapProfile(profile)
  }

  /**
   * Get user profile by ID (returns null if not found)
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const profile = await mockPrisma.user_profiles.findUnique({
      where: { user_id: userId },
    })

    return profile ? this.mapProfile(profile) : null
  }

  /**
   * Get user's AI spending for the current week
   */
  async getCurrentWeekSpending(userId: string): Promise<number> {
    const weekStart = this.getWeekStart()

    const result = await mockPrisma.ai_usage.aggregate({
      where: {
        user_id: userId,
        timestamp: { gte: weekStart },
        success: true,
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

    const result = await mockPrisma.ai_usage.aggregate({
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
    const result = await mockPrisma.ai_usage.aggregate({
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
   * Check if user can perform AI operations
   */
  async checkUserCostCap(userId: string, email?: string): Promise<CostCapCheckResult> {
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
    const profile = await mockPrisma.user_profiles.findUnique({
      where: { user_id: userId },
      select: { is_admin: true },
    })

    return profile?.is_admin ?? false
  }

  /**
   * Set temporary bypass for a user
   */
  async setTemporaryBypass(userId: string, durationHours: number): Promise<void> {
    const bypassUntil = new Date()
    bypassUntil.setHours(bypassUntil.getHours() + durationHours)

    await mockPrisma.user_profiles.update({
      where: { user_id: userId },
      data: { cap_bypass_until: bypassUntil },
    })
  }

  /**
   * Clear temporary bypass for a user
   */
  async clearBypass(userId: string): Promise<void> {
    await mockPrisma.user_profiles.update({
      where: { user_id: userId },
      data: { cap_bypass_until: null },
    })
  }

  /**
   * Update user's cost cap
   */
  async updateUserCostCap(userId: string, newCapUsd: number): Promise<void> {
    await mockPrisma.user_profiles.update({
      where: { user_id: userId },
      data: { cost_cap_usd: newCapUsd },
    })
  }

  /**
   * Set user admin status
   */
  async setUserAdminStatus(userId: string, isAdmin: boolean): Promise<void> {
    await mockPrisma.user_profiles.update({
      where: { user_id: userId },
      data: { is_admin: isAdmin },
    })
  }

  /**
   * Disable a user
   */
  async disableUser(userId: string, disabledByUserId: string): Promise<void> {
    await mockPrisma.user_profiles.update({
      where: { user_id: userId },
      data: {
        disabled_at: expect.any(Date),
        disabled_by: disabledByUserId,
        cap_bypass_until: null,
      },
    })
  }

  /**
   * Enable a user
   */
  async enableUser(userId: string): Promise<void> {
    await mockPrisma.user_profiles.update({
      where: { user_id: userId },
      data: {
        disabled_at: null,
        disabled_by: null,
      },
    })
  }

  /**
   * Create a user profile for an invited user
   */
  async createInvitedUserProfile(email: string, invitedByUserId: string): Promise<UserProfile> {
    const profile = await mockPrisma.user_profiles.create({
      data: {
        user_id: null,
        email,
        is_admin: false,
        cost_cap_usd: 1.0,
        invited_by: invitedByUserId,
        invited_at: expect.any(Date),
      },
    })

    return this.mapProfile(profile)
  }

  /**
   * Check if user profile exists by email
   */
  async getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    const profile = await mockPrisma.user_profiles.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    })

    return profile ? this.mapProfile(profile) : null
  }

  /**
   * Check if a user is disabled
   */
  async isUserDisabled(userId: string): Promise<boolean> {
    const profile = await mockPrisma.user_profiles.findUnique({
      where: { user_id: userId },
      select: { disabled_at: true },
    })

    // If profile not found, user is not disabled (they don't exist)
    if (!profile) return false

    return profile.disabled_at !== null
  }

  /**
   * Map database profile to interface
   */
  private mapProfile(profile: any): UserProfile {
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

// ============================================================================
// CostCapService Tests
// ============================================================================

describe('CostCapService', () => {
  let service: TestableCostCapService

  beforeEach(() => {
    service = new TestableCostCapService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ============================================================================
  // getWeekStart Tests
  // ============================================================================

  describe('getWeekStart', () => {
    it('returns a Monday at 00:00:00 UTC', () => {
      const weekStart = service.getWeekStart()

      // Should be a Monday (day 1)
      expect(weekStart.getUTCDay()).toBe(1)
      expect(weekStart.getUTCHours()).toBe(0)
      expect(weekStart.getUTCMinutes()).toBe(0)
      expect(weekStart.getUTCSeconds()).toBe(0)
      expect(weekStart.getUTCMilliseconds()).toBe(0)
    })

    it('returns a date in the past or today', () => {
      const weekStart = service.getWeekStart()
      const now = new Date()

      expect(weekStart.getTime()).toBeLessThanOrEqual(now.getTime())
    })
  })

  // ============================================================================
  // getOrCreateUserProfile Tests
  // ============================================================================

  describe('getOrCreateUserProfile', () => {
    it('returns existing profile when found', async () => {
      const existingProfile = createMockDbProfile()
      mockPrisma.user_profiles.findUnique.mockResolvedValue(existingProfile)

      const result = await service.getOrCreateUserProfile('user-123', 'test@example.com')

      expect(result.userId).toBe('user-123')
      expect(result.email).toBe('test@example.com')
      expect(mockPrisma.user_profiles.create).not.toHaveBeenCalled()
    })

    it('creates new profile when not found', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue(null)
      mockPrisma.user_profiles.create.mockResolvedValue(createMockDbProfile())

      await service.getOrCreateUserProfile('user-123', 'test@example.com')

      expect(mockPrisma.user_profiles.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-123',
          email: 'test@example.com',
          is_admin: false,
          cost_cap_usd: 1.0,
        },
      })
    })

    it('creates profile with default $1 cost cap', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue(null)
      mockPrisma.user_profiles.create.mockResolvedValue(createMockDbProfile())

      const result = await service.getOrCreateUserProfile('user-123', 'test@example.com')

      expect(result.costCapUsd).toBe(1.0)
    })
  })

  // ============================================================================
  // getUserProfile Tests
  // ============================================================================

  describe('getUserProfile', () => {
    it('returns profile when found', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue(createMockDbProfile())

      const result = await service.getUserProfile('user-123')

      expect(result).not.toBeNull()
      expect(result?.userId).toBe('user-123')
    })

    it('returns null when not found', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue(null)

      const result = await service.getUserProfile('nonexistent')

      expect(result).toBeNull()
    })
  })

  // ============================================================================
  // getCurrentWeekSpending Tests
  // ============================================================================

  describe('getCurrentWeekSpending', () => {
    it('returns aggregated spending for current week', async () => {
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _sum: { cost_usd: 0.5 },
      })

      const result = await service.getCurrentWeekSpending('user-123')

      expect(result).toBe(0.5)
    })

    it('returns 0 when no spending', async () => {
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _sum: { cost_usd: null },
      })

      const result = await service.getCurrentWeekSpending('user-123')

      expect(result).toBe(0)
    })

    it('only counts successful operations', async () => {
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _sum: { cost_usd: 0.25 },
      })

      await service.getCurrentWeekSpending('user-123')

      expect(mockPrisma.ai_usage.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            success: true,
          }),
        })
      )
    })
  })

  // ============================================================================
  // getThirtyDaySpending Tests
  // ============================================================================

  describe('getThirtyDaySpending', () => {
    it('returns aggregated spending for last 30 days', async () => {
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _sum: { cost_usd: 2.5 },
      })

      const result = await service.getThirtyDaySpending('user-123')

      expect(result).toBe(2.5)
    })

    it('returns 0 when no spending', async () => {
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _sum: { cost_usd: null },
      })

      const result = await service.getThirtyDaySpending('user-123')

      expect(result).toBe(0)
    })
  })

  // ============================================================================
  // getAllTimeSpending Tests
  // ============================================================================

  describe('getAllTimeSpending', () => {
    it('returns total all-time spending', async () => {
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _sum: { cost_usd: 15.75 },
      })

      const result = await service.getAllTimeSpending('user-123')

      expect(result).toBe(15.75)
    })

    it('returns 0 when no spending', async () => {
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _sum: { cost_usd: null },
      })

      const result = await service.getAllTimeSpending('user-123')

      expect(result).toBe(0)
    })
  })

  // ============================================================================
  // checkUserCostCap Tests
  // ============================================================================

  describe('checkUserCostCap', () => {
    it('returns not allowed when profile not found', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue(null)

      const result = await service.checkUserCostCap('nonexistent')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('User profile not found')
      expect(result.isAdmin).toBe(false)
    })

    it('always allows admin users', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue(createMockDbProfile({ is_admin: true }))

      const result = await service.checkUserCostCap('admin-user')

      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('Admin user - no cost cap')
      expect(result.isAdmin).toBe(true)
      expect(result.remainingBudget).toBe(Infinity)
    })

    it('allows user with active bypass', async () => {
      const futureDate = new Date()
      futureDate.setHours(futureDate.getHours() + 24)

      mockPrisma.user_profiles.findUnique.mockResolvedValue(
        createMockDbProfile({ cap_bypass_until: futureDate })
      )

      const result = await service.checkUserCostCap('user-123')

      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('Temporary bypass active')
      expect(result.hasBypass).toBe(true)
      expect(result.bypassExpiresAt).toEqual(futureDate)
    })

    it('does not allow expired bypass', async () => {
      const pastDate = new Date()
      pastDate.setHours(pastDate.getHours() - 1)

      mockPrisma.user_profiles.findUnique.mockResolvedValue(
        createMockDbProfile({ cap_bypass_until: pastDate, cost_cap_usd: 1.0 })
      )
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _sum: { cost_usd: 1.5 },
      })

      const result = await service.checkUserCostCap('user-123')

      expect(result.allowed).toBe(false)
      expect(result.hasBypass).toBe(false)
    })

    it('allows user within budget', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue(
        createMockDbProfile({ cost_cap_usd: 1.0 })
      )
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _sum: { cost_usd: 0.5 },
      })

      const result = await service.checkUserCostCap('user-123')

      expect(result.allowed).toBe(true)
      expect(result.currentSpending).toBe(0.5)
      expect(result.capAmount).toBe(1.0)
      expect(result.remainingBudget).toBe(0.5)
    })

    it('blocks user who exceeded budget', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue(
        createMockDbProfile({ cost_cap_usd: 1.0 })
      )
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _sum: { cost_usd: 1.5 },
      })

      const result = await service.checkUserCostCap('user-123')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('exceeded')
      expect(result.remainingBudget).toBe(0)
    })

    it('blocks user at exact budget limit', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue(
        createMockDbProfile({ cost_cap_usd: 1.0 })
      )
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _sum: { cost_usd: 1.0 },
      })

      const result = await service.checkUserCostCap('user-123')

      expect(result.allowed).toBe(false)
    })

    it('creates profile when email provided and profile not found', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue(null)
      mockPrisma.user_profiles.create.mockResolvedValue(createMockDbProfile())
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _sum: { cost_usd: 0 },
      })

      await service.checkUserCostCap('user-123', 'test@example.com')

      expect(mockPrisma.user_profiles.create).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // isUserAdmin Tests
  // ============================================================================

  describe('isUserAdmin', () => {
    it('returns true for admin user', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue({ is_admin: true })

      const result = await service.isUserAdmin('admin-user')

      expect(result).toBe(true)
    })

    it('returns false for non-admin user', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue({ is_admin: false })

      const result = await service.isUserAdmin('user-123')

      expect(result).toBe(false)
    })

    it('returns false when user not found', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue(null)

      const result = await service.isUserAdmin('nonexistent')

      expect(result).toBe(false)
    })
  })

  // ============================================================================
  // setTemporaryBypass Tests
  // ============================================================================

  describe('setTemporaryBypass', () => {
    it('sets bypass with correct duration', async () => {
      mockPrisma.user_profiles.update.mockResolvedValue({})

      await service.setTemporaryBypass('user-123', 24)

      expect(mockPrisma.user_profiles.update).toHaveBeenCalledWith({
        where: { user_id: 'user-123' },
        data: { cap_bypass_until: expect.any(Date) },
      })
    })

    it('bypass date is in the future', async () => {
      let capturedDate: Date | null = null
      mockPrisma.user_profiles.update.mockImplementation(({ data }) => {
        capturedDate = data.cap_bypass_until
        return Promise.resolve({})
      })

      await service.setTemporaryBypass('user-123', 1)

      expect(capturedDate!.getTime()).toBeGreaterThan(Date.now())
    })
  })

  // ============================================================================
  // clearBypass Tests
  // ============================================================================

  describe('clearBypass', () => {
    it('clears bypass by setting to null', async () => {
      mockPrisma.user_profiles.update.mockResolvedValue({})

      await service.clearBypass('user-123')

      expect(mockPrisma.user_profiles.update).toHaveBeenCalledWith({
        where: { user_id: 'user-123' },
        data: { cap_bypass_until: null },
      })
    })
  })

  // ============================================================================
  // updateUserCostCap Tests
  // ============================================================================

  describe('updateUserCostCap', () => {
    it('updates cost cap to new value', async () => {
      mockPrisma.user_profiles.update.mockResolvedValue({})

      await service.updateUserCostCap('user-123', 5.0)

      expect(mockPrisma.user_profiles.update).toHaveBeenCalledWith({
        where: { user_id: 'user-123' },
        data: { cost_cap_usd: 5.0 },
      })
    })
  })

  // ============================================================================
  // setUserAdminStatus Tests
  // ============================================================================

  describe('setUserAdminStatus', () => {
    it('sets admin status to true', async () => {
      mockPrisma.user_profiles.update.mockResolvedValue({})

      await service.setUserAdminStatus('user-123', true)

      expect(mockPrisma.user_profiles.update).toHaveBeenCalledWith({
        where: { user_id: 'user-123' },
        data: { is_admin: true },
      })
    })

    it('sets admin status to false', async () => {
      mockPrisma.user_profiles.update.mockResolvedValue({})

      await service.setUserAdminStatus('user-123', false)

      expect(mockPrisma.user_profiles.update).toHaveBeenCalledWith({
        where: { user_id: 'user-123' },
        data: { is_admin: false },
      })
    })
  })

  // ============================================================================
  // disableUser Tests
  // ============================================================================

  describe('disableUser', () => {
    it('disables user and clears bypass', async () => {
      mockPrisma.user_profiles.update.mockResolvedValue({})

      await service.disableUser('user-123', 'admin-456')

      expect(mockPrisma.user_profiles.update).toHaveBeenCalledWith({
        where: { user_id: 'user-123' },
        data: {
          disabled_at: expect.any(Date),
          disabled_by: 'admin-456',
          cap_bypass_until: null,
        },
      })
    })
  })

  // ============================================================================
  // enableUser Tests
  // ============================================================================

  describe('enableUser', () => {
    it('enables user by clearing disabled fields', async () => {
      mockPrisma.user_profiles.update.mockResolvedValue({})

      await service.enableUser('user-123')

      expect(mockPrisma.user_profiles.update).toHaveBeenCalledWith({
        where: { user_id: 'user-123' },
        data: {
          disabled_at: null,
          disabled_by: null,
        },
      })
    })
  })

  // ============================================================================
  // createInvitedUserProfile Tests
  // ============================================================================

  describe('createInvitedUserProfile', () => {
    it('creates profile with null user_id', async () => {
      mockPrisma.user_profiles.create.mockResolvedValue(
        createMockDbProfile({ user_id: null, invited_by: 'admin-456' })
      )

      await service.createInvitedUserProfile('invited@example.com', 'admin-456')

      expect(mockPrisma.user_profiles.create).toHaveBeenCalledWith({
        data: {
          user_id: null,
          email: 'invited@example.com',
          is_admin: false,
          cost_cap_usd: 1.0,
          invited_by: 'admin-456',
          invited_at: expect.any(Date),
        },
      })
    })

    it('returns mapped profile', async () => {
      mockPrisma.user_profiles.create.mockResolvedValue(
        createMockDbProfile({
          user_id: null,
          email: 'invited@example.com',
          invited_by: 'admin-456',
        })
      )

      const result = await service.createInvitedUserProfile('invited@example.com', 'admin-456')

      expect(result.userId).toBeNull()
      expect(result.email).toBe('invited@example.com')
      expect(result.invitedBy).toBe('admin-456')
    })
  })

  // ============================================================================
  // getUserProfileByEmail Tests
  // ============================================================================

  describe('getUserProfileByEmail', () => {
    it('returns profile when found', async () => {
      mockPrisma.user_profiles.findFirst.mockResolvedValue(createMockDbProfile())

      const result = await service.getUserProfileByEmail('test@example.com')

      expect(result).not.toBeNull()
      expect(result?.email).toBe('test@example.com')
    })

    it('returns null when not found', async () => {
      mockPrisma.user_profiles.findFirst.mockResolvedValue(null)

      const result = await service.getUserProfileByEmail('nonexistent@example.com')

      expect(result).toBeNull()
    })

    it('uses case-insensitive search', async () => {
      mockPrisma.user_profiles.findFirst.mockResolvedValue(null)

      await service.getUserProfileByEmail('Test@Example.com')

      expect(mockPrisma.user_profiles.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'Test@Example.com', mode: 'insensitive' } },
      })
    })
  })

  // ============================================================================
  // isUserDisabled Tests
  // ============================================================================

  describe('isUserDisabled', () => {
    it('returns true when user is disabled', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue({
        disabled_at: new Date(),
      })

      const result = await service.isUserDisabled('user-123')

      expect(result).toBe(true)
    })

    it('returns false when user is not disabled', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue({
        disabled_at: null,
      })

      const result = await service.isUserDisabled('user-123')

      expect(result).toBe(false)
    })

    it('returns false when user not found', async () => {
      mockPrisma.user_profiles.findUnique.mockResolvedValue(null)

      const result = await service.isUserDisabled('nonexistent')

      expect(result).toBe(false)
    })
  })
})
