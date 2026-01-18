import { prisma } from '~/server/utils/prisma'
import type { DrawLifecycleStatus } from '~/types'

/**
 * Service to manage draw lifecycle transitions
 * Handles archiving completed draws to historic status
 */
export class DrawLifecycleService {
  /**
   * Check if all matches in a draw have results
   * @param drawId - The database ID of the draw
   * @returns Whether all matches have result_home, result_away, and outcome set
   */
  async checkDrawCompletion(drawId: number): Promise<boolean> {
    try {
      const matches = await prisma.matches.findMany({
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
        match => match.result_home !== null && match.result_away !== null && match.outcome !== null
      )
    } catch (error) {
      console.error(`[Draw Lifecycle] Error checking draw completion for draw ID ${drawId}:`, error)
      return false
    }
  }

  /**
   * Check if a draw should be archived
   */
  async shouldArchive(
    drawNumber: number,
    gameType: string = 'stryktipset'
  ): Promise<DrawLifecycleStatus> {
    try {
      const draw = await prisma.draws.findUnique({
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

      // Already archived
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
        match => match.result_home !== null && match.result_away !== null && match.outcome !== null
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

      // Should archive - all matches have results
      console.log(
        `[Draw Lifecycle] Draw ${drawNumber} (${gameType}) ready to archive: all ${draw.matches.length} matches have results`
      )
      return {
        draw_number: drawNumber,
        is_current: true,
        archived_at: null,
        should_archive: true,
        reason: 'All matches have results',
      }
    } catch (error) {
      console.error(`[Draw Lifecycle] Error checking if draw ${drawNumber} should archive:`, error)
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
      console.log(`[Draw Lifecycle] Archiving draw ${drawNumber} (${gameType})`)

      await prisma.draws.update({
        where: { game_type_draw_number: { game_type: gameType, draw_number: drawNumber } },
        data: {
          status: 'Completed',
          is_current: false,
          archived_at: new Date(),
        },
      })

      console.log(
        `[Draw Lifecycle] Draw ${drawNumber} archived successfully (status set to Completed)`
      )
      return true
    } catch (error) {
      console.error(`[Draw Lifecycle] Error archiving draw ${drawNumber}:`, error)
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
      console.log('[Draw Lifecycle] Checking for completed draws to archive...')

      // Get all current draws with game_type
      const currentDraws = await prisma.draws.findMany({
        where: { is_current: true },
        select: { draw_number: true, game_type: true, status: true },
      })

      console.log(`[Draw Lifecycle] Found ${currentDraws.length} current draws`)

      let checked = 0
      let archived = 0
      let errors = 0

      for (const draw of currentDraws) {
        checked++

        // Check if should archive
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

      console.log(
        `[Draw Lifecycle] Completed: ${checked} checked, ${archived} archived, ${errors} errors`
      )

      return { checked, archived, errors }
    } catch (error) {
      console.error('[Draw Lifecycle] Error in checkAndArchiveCompletedDraws:', error)
      return { checked: 0, archived: 0, errors: 1 }
    }
  }

  /**
   * Get current draws count
   */
  async getCurrentDrawsCount(): Promise<number> {
    try {
      return await prisma.draws.count({
        where: { is_current: true },
      })
    } catch (error) {
      console.error('[Draw Lifecycle] Error getting current draws count:', error)
      return 0
    }
  }

  /**
   * Get archived draws count
   */
  async getArchivedDrawsCount(): Promise<number> {
    try {
      return await prisma.draws.count({
        where: { is_current: false },
      })
    } catch (error) {
      console.error('[Draw Lifecycle] Error getting archived draws count:', error)
      return 0
    }
  }

  /**
   * Manually archive a draw (admin action)
   * @param drawNumber - The draw number to archive
   * @param force - If true, bypass validation checks and archive regardless of match results
   * @param gameType - The game type (defaults to 'stryktipset')
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
      const draw = await prisma.draws.findUnique({
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

      // If not forcing, validate that all matches have results
      const allMatchesComplete = await this.checkDrawCompletion(draw.id)
      if (!force && !allMatchesComplete) {
        return {
          success: false,
          error: 'Cannot archive: not all matches have results. Use force option to override.',
        }
      }

      // Log force archive for audit
      if (force && !allMatchesComplete) {
        console.warn(
          `[Draw Lifecycle] Force archiving draw ${drawNumber} without all match results (admin override)`
        )
      }

      console.log(
        `[Draw Lifecycle] Manually archiving draw ${drawNumber}${force ? ' (forced)' : ''}`
      )

      await prisma.draws.update({
        where: { game_type_draw_number: { game_type: gameType, draw_number: drawNumber } },
        data: {
          status: 'Completed',
          is_current: false,
          archived_at: new Date(),
        },
      })

      console.log(
        `[Draw Lifecycle] Draw ${drawNumber} manually archived successfully (status set to Completed)`
      )

      return {
        success: true,
        wasForced: force && !allMatchesComplete,
      }
    } catch (error) {
      console.error(`[Draw Lifecycle] Error manually archiving draw ${drawNumber}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

// Export singleton instance
export const drawLifecycle = new DrawLifecycleService()
