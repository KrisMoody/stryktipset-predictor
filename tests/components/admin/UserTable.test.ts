import { describe, it, expect } from 'vitest'

// ============================================================================
// Test the pure logic extracted from UserTable component
// ============================================================================

interface UserWithSpending {
  id: number
  userId: string | null
  email: string
  isAdmin: boolean
  costCapUsd: number
  capBypassUntil: string | null
  currentWeekSpending: number
  thirtyDaySpending: number
  allTimeSpending: number
  remainingBudget: number
  invitedBy: string | null
  invitedAt: string | null
  disabledAt: string | null
  disabledBy: string | null
  createdAt: string
  updatedAt: string
}

// Format cost for display
const formatCost = (cost: number): string => {
  if (cost >= 1) return cost.toFixed(2)
  if (cost >= 0.01) return cost.toFixed(3)
  return cost.toFixed(4)
}

// Format date for display
const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Check if user has active bypass
const hasActiveBypass = (user: UserWithSpending): boolean => {
  if (!user.capBypassUntil) return false
  return new Date(user.capBypassUntil) > new Date()
}

// Get spending percentage
const getSpendingPercent = (user: UserWithSpending): number => {
  if (user.isAdmin || user.costCapUsd === 0) return 0
  return Math.min(100, (user.currentWeekSpending / user.costCapUsd) * 100)
}

// Get spending text color class
const getSpendingColor = (user: UserWithSpending): string => {
  if (user.isAdmin) return 'text-gray-600 dark:text-gray-400'
  const percent = getSpendingPercent(user)
  if (percent >= 100) return 'text-red-600 dark:text-red-400 font-medium'
  if (percent >= 80) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-green-600 dark:text-green-400'
}

// Get progress bar color class
const getProgressBarColor = (user: UserWithSpending): string => {
  const percent = getSpendingPercent(user)
  if (percent >= 100) return 'bg-red-500'
  if (percent >= 80) return 'bg-yellow-500'
  return 'bg-green-500'
}

// Check if user is pending (not yet accepted invite)
const isPendingUser = (user: UserWithSpending): boolean => {
  return user.userId === null
}

// Check if user is disabled
const isDisabledUser = (user: UserWithSpending): boolean => {
  return user.disabledAt !== null
}

// Check if user can be edited (not current user)
const canEditUser = (user: UserWithSpending, currentUserId: string | null): boolean => {
  return user.userId !== currentUserId
}

// Get user status badges
const getUserStatusBadges = (user: UserWithSpending): string[] => {
  const badges: string[] = []
  if (user.isAdmin) badges.push('Admin')
  if (user.disabledAt) badges.push('Disabled')
  if (hasActiveBypass(user)) badges.push('Bypass')
  if (user.userId === null) badges.push('Pending')
  return badges
}

// ============================================================================
// Test Data Factories
// ============================================================================

const createTestUser = (overrides: Partial<UserWithSpending> = {}): UserWithSpending => ({
  id: 1,
  userId: 'user-123',
  email: 'test@example.com',
  isAdmin: false,
  costCapUsd: 1.0,
  capBypassUntil: null,
  currentWeekSpending: 0.5,
  thirtyDaySpending: 2.0,
  allTimeSpending: 10.0,
  remainingBudget: 0.5,
  invitedBy: null,
  invitedAt: null,
  disabledAt: null,
  disabledBy: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

// ============================================================================
// Tests
// ============================================================================

describe('UserTable', () => {
  // ============================================================================
  // formatCost Tests
  // ============================================================================

  describe('formatCost', () => {
    it('formats costs >= 1 with 2 decimal places', () => {
      expect(formatCost(1.5)).toBe('1.50')
      expect(formatCost(10.0)).toBe('10.00')
      expect(formatCost(100.123)).toBe('100.12')
    })

    it('formats costs >= 0.01 with 3 decimal places', () => {
      expect(formatCost(0.5)).toBe('0.500')
      expect(formatCost(0.01)).toBe('0.010')
      expect(formatCost(0.123)).toBe('0.123')
    })

    it('formats small costs with 4 decimal places', () => {
      expect(formatCost(0.001)).toBe('0.0010')
      expect(formatCost(0.0001)).toBe('0.0001')
      expect(formatCost(0.00999)).toBe('0.0100')
    })

    it('formats zero correctly', () => {
      expect(formatCost(0)).toBe('0.0000')
    })

    it('handles edge cases at boundaries', () => {
      expect(formatCost(0.99)).toBe('0.990')
      expect(formatCost(1.0)).toBe('1.00')
      expect(formatCost(0.0099)).toBe('0.0099')
      expect(formatCost(0.01)).toBe('0.010')
    })
  })

  // ============================================================================
  // formatDate Tests
  // ============================================================================

  describe('formatDate', () => {
    it('formats date in Swedish locale', () => {
      // Note: Exact format may vary by environment
      const result = formatDate('2024-06-15T00:00:00.000Z')
      expect(result).toContain('2024')
      expect(result).toContain('15')
    })

    it('handles various date formats', () => {
      const result = formatDate('2024-01-01T12:00:00.000Z')
      expect(result).toContain('2024')
    })
  })

  // ============================================================================
  // hasActiveBypass Tests
  // ============================================================================

  describe('hasActiveBypass', () => {
    it('returns false when no bypass', () => {
      const user = createTestUser({ capBypassUntil: null })
      expect(hasActiveBypass(user)).toBe(false)
    })

    it('returns true when bypass is in future', () => {
      const futureDate = new Date()
      futureDate.setHours(futureDate.getHours() + 24)
      const user = createTestUser({ capBypassUntil: futureDate.toISOString() })
      expect(hasActiveBypass(user)).toBe(true)
    })

    it('returns false when bypass has expired', () => {
      const pastDate = new Date()
      pastDate.setHours(pastDate.getHours() - 1)
      const user = createTestUser({ capBypassUntil: pastDate.toISOString() })
      expect(hasActiveBypass(user)).toBe(false)
    })
  })

  // ============================================================================
  // getSpendingPercent Tests
  // ============================================================================

  describe('getSpendingPercent', () => {
    it('returns 0 for admin users', () => {
      const user = createTestUser({ isAdmin: true, currentWeekSpending: 100, costCapUsd: 1 })
      expect(getSpendingPercent(user)).toBe(0)
    })

    it('returns 0 when cost cap is 0', () => {
      const user = createTestUser({ costCapUsd: 0, currentWeekSpending: 0.5 })
      expect(getSpendingPercent(user)).toBe(0)
    })

    it('calculates correct percentage', () => {
      const user = createTestUser({ currentWeekSpending: 0.5, costCapUsd: 1.0 })
      expect(getSpendingPercent(user)).toBe(50)
    })

    it('caps at 100%', () => {
      const user = createTestUser({ currentWeekSpending: 2.0, costCapUsd: 1.0 })
      expect(getSpendingPercent(user)).toBe(100)
    })

    it('handles exact cap limit', () => {
      const user = createTestUser({ currentWeekSpending: 1.0, costCapUsd: 1.0 })
      expect(getSpendingPercent(user)).toBe(100)
    })

    it('handles zero spending', () => {
      const user = createTestUser({ currentWeekSpending: 0, costCapUsd: 1.0 })
      expect(getSpendingPercent(user)).toBe(0)
    })
  })

  // ============================================================================
  // getSpendingColor Tests
  // ============================================================================

  describe('getSpendingColor', () => {
    it('returns gray for admin users', () => {
      const user = createTestUser({ isAdmin: true })
      expect(getSpendingColor(user)).toContain('gray')
    })

    it('returns green for spending < 80%', () => {
      const user = createTestUser({ currentWeekSpending: 0.5, costCapUsd: 1.0 })
      expect(getSpendingColor(user)).toContain('green')
    })

    it('returns yellow for spending >= 80% and < 100%', () => {
      const user = createTestUser({ currentWeekSpending: 0.85, costCapUsd: 1.0 })
      expect(getSpendingColor(user)).toContain('yellow')
    })

    it('returns red for spending >= 100%', () => {
      const user = createTestUser({ currentWeekSpending: 1.0, costCapUsd: 1.0 })
      expect(getSpendingColor(user)).toContain('red')
    })

    it('returns red for overspending', () => {
      const user = createTestUser({ currentWeekSpending: 1.5, costCapUsd: 1.0 })
      expect(getSpendingColor(user)).toContain('red')
    })
  })

  // ============================================================================
  // getProgressBarColor Tests
  // ============================================================================

  describe('getProgressBarColor', () => {
    it('returns green for low spending', () => {
      const user = createTestUser({ currentWeekSpending: 0.3, costCapUsd: 1.0 })
      expect(getProgressBarColor(user)).toBe('bg-green-500')
    })

    it('returns yellow for 80% spending', () => {
      const user = createTestUser({ currentWeekSpending: 0.8, costCapUsd: 1.0 })
      expect(getProgressBarColor(user)).toBe('bg-yellow-500')
    })

    it('returns red for 100% spending', () => {
      const user = createTestUser({ currentWeekSpending: 1.0, costCapUsd: 1.0 })
      expect(getProgressBarColor(user)).toBe('bg-red-500')
    })

    it('returns green for exactly 79% spending', () => {
      const user = createTestUser({ currentWeekSpending: 0.79, costCapUsd: 1.0 })
      expect(getProgressBarColor(user)).toBe('bg-green-500')
    })
  })

  // ============================================================================
  // isPendingUser Tests
  // ============================================================================

  describe('isPendingUser', () => {
    it('returns true when userId is null', () => {
      const user = createTestUser({ userId: null })
      expect(isPendingUser(user)).toBe(true)
    })

    it('returns false when userId exists', () => {
      const user = createTestUser({ userId: 'user-123' })
      expect(isPendingUser(user)).toBe(false)
    })
  })

  // ============================================================================
  // isDisabledUser Tests
  // ============================================================================

  describe('isDisabledUser', () => {
    it('returns true when disabledAt is set', () => {
      const user = createTestUser({ disabledAt: '2024-01-01T00:00:00.000Z' })
      expect(isDisabledUser(user)).toBe(true)
    })

    it('returns false when disabledAt is null', () => {
      const user = createTestUser({ disabledAt: null })
      expect(isDisabledUser(user)).toBe(false)
    })
  })

  // ============================================================================
  // canEditUser Tests
  // ============================================================================

  describe('canEditUser', () => {
    it('returns false when user is current user', () => {
      const user = createTestUser({ userId: 'user-123' })
      expect(canEditUser(user, 'user-123')).toBe(false)
    })

    it('returns true when user is different from current user', () => {
      const user = createTestUser({ userId: 'user-456' })
      expect(canEditUser(user, 'user-123')).toBe(true)
    })

    it('returns true when currentUserId is null', () => {
      const user = createTestUser({ userId: 'user-123' })
      expect(canEditUser(user, null)).toBe(true)
    })

    it('returns true for pending users', () => {
      const user = createTestUser({ userId: null })
      expect(canEditUser(user, 'user-123')).toBe(true)
    })
  })

  // ============================================================================
  // getUserStatusBadges Tests
  // ============================================================================

  describe('getUserStatusBadges', () => {
    it('returns empty array for regular user', () => {
      const user = createTestUser()
      expect(getUserStatusBadges(user)).toEqual([])
    })

    it('returns Admin badge for admin', () => {
      const user = createTestUser({ isAdmin: true })
      expect(getUserStatusBadges(user)).toContain('Admin')
    })

    it('returns Disabled badge for disabled user', () => {
      const user = createTestUser({ disabledAt: '2024-01-01T00:00:00.000Z' })
      expect(getUserStatusBadges(user)).toContain('Disabled')
    })

    it('returns Bypass badge for user with active bypass', () => {
      const futureDate = new Date()
      futureDate.setHours(futureDate.getHours() + 24)
      const user = createTestUser({ capBypassUntil: futureDate.toISOString() })
      expect(getUserStatusBadges(user)).toContain('Bypass')
    })

    it('returns Pending badge for pending user', () => {
      const user = createTestUser({ userId: null })
      expect(getUserStatusBadges(user)).toContain('Pending')
    })

    it('returns multiple badges when applicable', () => {
      const user = createTestUser({
        isAdmin: true,
        disabledAt: '2024-01-01T00:00:00.000Z',
      })
      const badges = getUserStatusBadges(user)
      expect(badges).toContain('Admin')
      expect(badges).toContain('Disabled')
    })

    it('does not return Bypass badge for expired bypass', () => {
      const pastDate = new Date()
      pastDate.setHours(pastDate.getHours() - 1)
      const user = createTestUser({ capBypassUntil: pastDate.toISOString() })
      expect(getUserStatusBadges(user)).not.toContain('Bypass')
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles user with all fields null', () => {
      const user = createTestUser({
        userId: null,
        capBypassUntil: null,
        disabledAt: null,
        invitedBy: null,
        invitedAt: null,
      })

      expect(isPendingUser(user)).toBe(true)
      expect(isDisabledUser(user)).toBe(false)
      expect(hasActiveBypass(user)).toBe(false)
    })

    it('handles very large spending values', () => {
      const user = createTestUser({
        currentWeekSpending: 1000000,
        costCapUsd: 1.0,
      })

      expect(getSpendingPercent(user)).toBe(100) // Capped at 100
      expect(formatCost(user.currentWeekSpending)).toBe('1000000.00')
    })

    it('handles very small spending values', () => {
      const user = createTestUser({
        currentWeekSpending: 0.00001,
        costCapUsd: 1.0,
      })

      expect(getSpendingPercent(user)).toBeCloseTo(0.001, 3)
      expect(formatCost(user.currentWeekSpending)).toBe('0.0000')
    })

    it('handles admin user with spending', () => {
      const user = createTestUser({
        isAdmin: true,
        currentWeekSpending: 100,
        costCapUsd: 1.0,
      })

      // Admin users should always show 0% spending
      expect(getSpendingPercent(user)).toBe(0)
      expect(getSpendingColor(user)).toContain('gray')
    })
  })
})
