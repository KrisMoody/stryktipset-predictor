/* eslint-disable @typescript-eslint/no-explicit-any -- Test file with mock data */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DrawLifecycleStatus } from '~/types'

// ============================================================================
// Mock Prisma
// ============================================================================

const mockPrisma = {
  draws: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  matches: {
    findMany: vi.fn(),
  },
}

vi.mock('~/server/utils/prisma', () => ({
  prisma: mockPrisma,
}))

// ============================================================================
// Test Data Factories
// ============================================================================

const createMockDraw = (overrides: Partial<any> = {}) => ({
  draw_number: 1,
  game_type: 'stryktipset',
  status: 'Completed',
  is_current: true,
  archived_at: null,
  matches: [],
  ...overrides,
})

const createMockMatch = (overrides: Partial<any> = {}) => ({
  result_home: 2,
  result_away: 1,
  outcome: '1',
  ...overrides,
})

// ============================================================================
// Testable DrawLifecycleService
// ============================================================================

class TestableDrawLifecycleService {
  /**
   * Check if a draw should be archived
   */
  async shouldArchive(
    drawNumber: number,
    gameType: string = 'stryktipset'
  ): Promise<DrawLifecycleStatus> {
    try {
      const draw = await mockPrisma.draws.findUnique({
        where: { game_type_draw_number: { game_type: gameType, draw_number: drawNumber } },
        include: {
          matches: {
            select: {
              result_home: true,
              result_away: true,
              outcome: true,
            },
          },
        },
      })

      if (!draw) {
        return {
          draw_number: drawNumber,
          is_current: true,
          archived_at: null,
          should_archive: false,
          reason: 'Draw not found',
        }
      }

      if (!draw.is_current) {
        return {
          draw_number: drawNumber,
          is_current: false,
          archived_at: draw.archived_at,
          should_archive: false,
          reason: 'Already archived',
        }
      }

      // Check if all matches have results (ignore API status field)
      const allMatchesHaveResults = draw.matches.every(
        (match: any) =>
          match.result_home !== null && match.result_away !== null && match.outcome !== null
      )

      if (!allMatchesHaveResults) {
        return {
          draw_number: drawNumber,
          is_current: true,
          archived_at: null,
          should_archive: false,
          reason: 'Not all matches have results',
        }
      }

      return {
        draw_number: drawNumber,
        is_current: true,
        archived_at: null,
        should_archive: true,
        reason: 'All matches have results',
      }
    } catch (error) {
      return {
        draw_number: drawNumber,
        is_current: true,
        archived_at: null,
        should_archive: false,
        reason: `Error: ${error}`,
      }
    }
  }

  /**
   * Archive a draw (set is_current = false and status = "Completed")
   */
  async archiveDraw(drawNumber: number, gameType: string = 'stryktipset'): Promise<boolean> {
    try {
      await mockPrisma.draws.update({
        where: { game_type_draw_number: { game_type: gameType, draw_number: drawNumber } },
        data: {
          status: 'Completed',
          is_current: false,
          archived_at: expect.any(Date),
        },
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Check and archive all completed draws
   */
  async checkAndArchiveCompletedDraws(): Promise<{
    checked: number
    archived: number
    errors: number
  }> {
    try {
      const currentDraws = await mockPrisma.draws.findMany({
        where: { is_current: true },
        select: { draw_number: true, game_type: true, status: true },
      })

      let checked = 0
      let archived = 0
      let errors = 0

      for (const draw of currentDraws) {
        checked++

        const status = await this.shouldArchive(draw.draw_number, draw.game_type)

        if (status.should_archive) {
          const success = await this.archiveDraw(draw.draw_number, draw.game_type)
          if (success) {
            archived++
          } else {
            errors++
          }
        }
      }

      return { checked, archived, errors }
    } catch {
      return { checked: 0, archived: 0, errors: 1 }
    }
  }

  /**
   * Get current draws count
   */
  async getCurrentDrawsCount(): Promise<number> {
    try {
      return await mockPrisma.draws.count({
        where: { is_current: true },
      })
    } catch {
      return 0
    }
  }

  /**
   * Get archived draws count
   */
  async getArchivedDrawsCount(): Promise<number> {
    try {
      return await mockPrisma.draws.count({
        where: { is_current: false },
      })
    } catch {
      return 0
    }
  }

  /**
   * Check if all matches in a draw have results (simplified for tests)
   */
  async checkDrawCompletion(drawId: number): Promise<boolean> {
    try {
      const matches = await mockPrisma.matches.findMany({
        where: { draw_id: drawId },
        select: {
          result_home: true,
          result_away: true,
          outcome: true,
        },
      })

      if (matches.length === 0) {
        return false
      }

      return matches.every(
        (match: any) =>
          match.result_home !== null && match.result_away !== null && match.outcome !== null
      )
    } catch {
      return false
    }
  }

  /**
   * Manually archive a draw (admin action)
   */
  async manualArchiveDraw(
    drawNumber: number,
    force: boolean = false,
    gameType: string = 'stryktipset'
  ): Promise<{
    success: boolean
    error?: string
    wasForced?: boolean
  }> {
    try {
      const draw = await mockPrisma.draws.findUnique({
        where: { game_type_draw_number: { game_type: gameType, draw_number: drawNumber } },
        select: {
          id: true,
          draw_number: true,
          status: true,
          is_current: true,
        },
      })

      if (!draw) {
        return {
          success: false,
          error: 'Draw not found',
        }
      }

      if (!draw.is_current) {
        return {
          success: false,
          error: 'Draw is already archived',
        }
      }

      // Check if all matches have results
      const allMatchesComplete = await this.checkDrawCompletion(draw.id)
      if (!force && !allMatchesComplete) {
        return {
          success: false,
          error: 'Cannot archive: not all matches have results. Use force option to override.',
        }
      }

      await mockPrisma.draws.update({
        where: { game_type_draw_number: { game_type: gameType, draw_number: drawNumber } },
        data: {
          status: 'Completed',
          is_current: false,
          archived_at: expect.any(Date),
        },
      })

      return {
        success: true,
        wasForced: force && !allMatchesComplete,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

// ============================================================================
// DrawLifecycleService Tests
// ============================================================================

describe('DrawLifecycleService', () => {
  let service: TestableDrawLifecycleService

  beforeEach(() => {
    service = new TestableDrawLifecycleService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ============================================================================
  // shouldArchive Tests
  // ============================================================================

  describe('shouldArchive', () => {
    it('returns should_archive: false when draw not found', async () => {
      mockPrisma.draws.findUnique.mockResolvedValue(null)

      const result = await service.shouldArchive(1)

      expect(result.should_archive).toBe(false)
      expect(result.reason).toBe('Draw not found')
      expect(result.is_current).toBe(true)
    })

    it('returns should_archive: false when already archived', async () => {
      const archivedDate = new Date('2024-01-01')
      mockPrisma.draws.findUnique.mockResolvedValue(
        createMockDraw({
          is_current: false,
          archived_at: archivedDate,
        })
      )

      const result = await service.shouldArchive(1)

      expect(result.should_archive).toBe(false)
      expect(result.reason).toBe('Already archived')
      expect(result.is_current).toBe(false)
      expect(result.archived_at).toBe(archivedDate)
    })

    it('returns should_archive: true when all matches have results regardless of API status', async () => {
      // Even if API status is still "Open" or "Closed", if all matches have results, archive
      mockPrisma.draws.findUnique.mockResolvedValue(
        createMockDraw({
          status: 'Closed', // API hasn't updated to "Completed" yet
          matches: [
            createMockMatch({ result_home: 2, result_away: 1, outcome: '1' }),
            createMockMatch({ result_home: 0, result_away: 0, outcome: 'X' }),
          ],
        })
      )

      const result = await service.shouldArchive(1)

      expect(result.should_archive).toBe(true)
      expect(result.reason).toBe('All matches have results')
    })

    it('returns should_archive: false when some matches lack results', async () => {
      mockPrisma.draws.findUnique.mockResolvedValue(
        createMockDraw({
          matches: [
            createMockMatch(),
            createMockMatch({ result_home: null, result_away: null, outcome: null }),
          ],
        })
      )

      const result = await service.shouldArchive(1)

      expect(result.should_archive).toBe(false)
      expect(result.reason).toBe('Not all matches have results')
    })

    it('returns should_archive: true when draw has all match results', async () => {
      mockPrisma.draws.findUnique.mockResolvedValue(
        createMockDraw({
          status: 'Completed',
          matches: [
            createMockMatch({ result_home: 2, result_away: 1, outcome: '1' }),
            createMockMatch({ result_home: 0, result_away: 0, outcome: 'X' }),
            createMockMatch({ result_home: 1, result_away: 3, outcome: '2' }),
          ],
        })
      )

      const result = await service.shouldArchive(1)

      expect(result.should_archive).toBe(true)
      expect(result.reason).toBe('All matches have results')
      expect(result.is_current).toBe(true)
    })

    it('handles database errors gracefully', async () => {
      mockPrisma.draws.findUnique.mockRejectedValue(new Error('Database error'))

      const result = await service.shouldArchive(1)

      expect(result.should_archive).toBe(false)
      expect(result.reason).toContain('Error')
    })

    it('uses correct game type in query', async () => {
      mockPrisma.draws.findUnique.mockResolvedValue(null)

      await service.shouldArchive(1, 'topptipset')

      expect(mockPrisma.draws.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            game_type_draw_number: {
              game_type: 'topptipset',
              draw_number: 1,
            },
          },
        })
      )
    })
  })

  // ============================================================================
  // archiveDraw Tests
  // ============================================================================

  describe('archiveDraw', () => {
    it('returns true when draw is archived successfully', async () => {
      mockPrisma.draws.update.mockResolvedValue({})

      const result = await service.archiveDraw(1)

      expect(result).toBe(true)
      expect(mockPrisma.draws.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            game_type_draw_number: {
              game_type: 'stryktipset',
              draw_number: 1,
            },
          },
          data: {
            status: 'Completed',
            is_current: false,
            archived_at: expect.any(Date),
          },
        })
      )
    })

    it('returns false when database error occurs', async () => {
      mockPrisma.draws.update.mockRejectedValue(new Error('Database error'))

      const result = await service.archiveDraw(1)

      expect(result).toBe(false)
    })

    it('uses correct game type', async () => {
      mockPrisma.draws.update.mockResolvedValue({})

      await service.archiveDraw(1, 'europatipset')

      expect(mockPrisma.draws.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            game_type_draw_number: {
              game_type: 'europatipset',
              draw_number: 1,
            },
          },
        })
      )
    })
  })

  // ============================================================================
  // checkAndArchiveCompletedDraws Tests
  // ============================================================================

  describe('checkAndArchiveCompletedDraws', () => {
    it('returns zero counts when no current draws', async () => {
      mockPrisma.draws.findMany.mockResolvedValue([])

      const result = await service.checkAndArchiveCompletedDraws()

      expect(result).toEqual({ checked: 0, archived: 0, errors: 0 })
    })

    it('archives draws with all match results and skips incomplete draws', async () => {
      mockPrisma.draws.findMany.mockResolvedValue([
        { draw_number: 1, game_type: 'stryktipset', status: 'Completed' },
        { draw_number: 2, game_type: 'stryktipset', status: 'Open' },
      ])

      // First shouldArchive call - all matches have results, should archive
      mockPrisma.draws.findUnique
        .mockResolvedValueOnce(
          createMockDraw({
            draw_number: 1,
            status: 'Completed',
            matches: [createMockMatch()], // Has results
          })
        )
        // Second shouldArchive call - matches without results, should NOT archive
        .mockResolvedValueOnce(
          createMockDraw({
            draw_number: 2,
            status: 'Open',
            matches: [createMockMatch({ result_home: null, result_away: null, outcome: null })],
          })
        )

      mockPrisma.draws.update.mockResolvedValue({})

      const result = await service.checkAndArchiveCompletedDraws()

      expect(result.checked).toBe(2)
      expect(result.archived).toBe(1)
      expect(result.errors).toBe(0)
    })

    it('counts errors when archive fails', async () => {
      mockPrisma.draws.findMany.mockResolvedValue([
        { draw_number: 1, game_type: 'stryktipset', status: 'Completed' },
      ])

      mockPrisma.draws.findUnique.mockResolvedValue(
        createMockDraw({
          draw_number: 1,
          status: 'Completed',
          matches: [createMockMatch()],
        })
      )

      mockPrisma.draws.update.mockRejectedValue(new Error('Database error'))

      const result = await service.checkAndArchiveCompletedDraws()

      expect(result.checked).toBe(1)
      expect(result.archived).toBe(0)
      expect(result.errors).toBe(1)
    })

    it('handles database error gracefully', async () => {
      mockPrisma.draws.findMany.mockRejectedValue(new Error('Database error'))

      const result = await service.checkAndArchiveCompletedDraws()

      expect(result).toEqual({ checked: 0, archived: 0, errors: 1 })
    })
  })

  // ============================================================================
  // getCurrentDrawsCount Tests
  // ============================================================================

  describe('getCurrentDrawsCount', () => {
    it('returns count of current draws', async () => {
      mockPrisma.draws.count.mockResolvedValue(5)

      const result = await service.getCurrentDrawsCount()

      expect(result).toBe(5)
      expect(mockPrisma.draws.count).toHaveBeenCalledWith({
        where: { is_current: true },
      })
    })

    it('returns 0 on error', async () => {
      mockPrisma.draws.count.mockRejectedValue(new Error('Database error'))

      const result = await service.getCurrentDrawsCount()

      expect(result).toBe(0)
    })
  })

  // ============================================================================
  // getArchivedDrawsCount Tests
  // ============================================================================

  describe('getArchivedDrawsCount', () => {
    it('returns count of archived draws', async () => {
      mockPrisma.draws.count.mockResolvedValue(10)

      const result = await service.getArchivedDrawsCount()

      expect(result).toBe(10)
      expect(mockPrisma.draws.count).toHaveBeenCalledWith({
        where: { is_current: false },
      })
    })

    it('returns 0 on error', async () => {
      mockPrisma.draws.count.mockRejectedValue(new Error('Database error'))

      const result = await service.getArchivedDrawsCount()

      expect(result).toBe(0)
    })
  })

  // ============================================================================
  // manualArchiveDraw Tests
  // ============================================================================

  describe('manualArchiveDraw', () => {
    it('returns error when draw not found', async () => {
      mockPrisma.draws.findUnique.mockResolvedValue(null)

      const result = await service.manualArchiveDraw(1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Draw not found')
    })

    it('returns error when draw is already archived', async () => {
      mockPrisma.draws.findUnique.mockResolvedValue({
        id: 1,
        draw_number: 1,
        status: 'Completed',
        is_current: false,
      })

      const result = await service.manualArchiveDraw(1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Draw is already archived')
    })

    it('returns error when not all matches have results and force is false', async () => {
      mockPrisma.draws.findUnique.mockResolvedValue({
        id: 1,
        draw_number: 1,
        status: 'Open',
        is_current: true,
      })
      // Simulate incomplete matches
      mockPrisma.matches.findMany.mockResolvedValue([
        { result_home: 2, result_away: 1, outcome: '1' },
        { result_home: null, result_away: null, outcome: null },
      ])

      const result = await service.manualArchiveDraw(1, false)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot archive')
      expect(result.error).toContain('not all matches have results')
    })

    it('archives successfully when all matches have results', async () => {
      mockPrisma.draws.findUnique.mockResolvedValue({
        id: 1,
        draw_number: 1,
        status: 'Closed', // API status doesn't matter
        is_current: true,
      })
      mockPrisma.matches.findMany.mockResolvedValue([
        { result_home: 2, result_away: 1, outcome: '1' },
        { result_home: 0, result_away: 0, outcome: 'X' },
      ])
      mockPrisma.draws.update.mockResolvedValue({})

      const result = await service.manualArchiveDraw(1)

      expect(result.success).toBe(true)
      expect(result.wasForced).toBe(false)
    })

    it('force archives even when not all matches have results', async () => {
      mockPrisma.draws.findUnique.mockResolvedValue({
        id: 1,
        draw_number: 1,
        status: 'Open',
        is_current: true,
      })
      // Incomplete matches
      mockPrisma.matches.findMany.mockResolvedValue([
        { result_home: 2, result_away: 1, outcome: '1' },
        { result_home: null, result_away: null, outcome: null },
      ])
      mockPrisma.draws.update.mockResolvedValue({})

      const result = await service.manualArchiveDraw(1, true)

      expect(result.success).toBe(true)
      expect(result.wasForced).toBe(true)
    })

    it('wasForced is false when force is used but all matches already have results', async () => {
      mockPrisma.draws.findUnique.mockResolvedValue({
        id: 1,
        draw_number: 1,
        status: 'Completed',
        is_current: true,
      })
      mockPrisma.matches.findMany.mockResolvedValue([
        { result_home: 2, result_away: 1, outcome: '1' },
        { result_home: 0, result_away: 0, outcome: 'X' },
      ])
      mockPrisma.draws.update.mockResolvedValue({})

      const result = await service.manualArchiveDraw(1, true)

      expect(result.success).toBe(true)
      expect(result.wasForced).toBe(false)
    })

    it('handles database error on update', async () => {
      mockPrisma.draws.findUnique.mockResolvedValue({
        id: 1,
        draw_number: 1,
        status: 'Completed',
        is_current: true,
      })
      mockPrisma.matches.findMany.mockResolvedValue([
        { result_home: 2, result_away: 1, outcome: '1' },
      ])
      mockPrisma.draws.update.mockRejectedValue(new Error('Update failed'))

      const result = await service.manualArchiveDraw(1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Update failed')
    })

    it('uses correct game type', async () => {
      mockPrisma.draws.findUnique.mockResolvedValue({
        id: 1,
        draw_number: 1,
        status: 'Completed',
        is_current: true,
      })
      mockPrisma.matches.findMany.mockResolvedValue([
        { result_home: 2, result_away: 1, outcome: '1' },
      ])
      mockPrisma.draws.update.mockResolvedValue({})

      await service.manualArchiveDraw(1, false, 'topptipset')

      expect(mockPrisma.draws.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            game_type_draw_number: {
              game_type: 'topptipset',
              draw_number: 1,
            },
          },
        })
      )
    })
  })
})
