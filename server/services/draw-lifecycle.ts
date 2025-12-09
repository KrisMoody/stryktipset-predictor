import { prisma } from '~/server/utils/prisma'
import type { DrawLifecycleStatus } from '~/types'

/**
 * Service to manage draw lifecycle transitions
 * Handles archiving completed draws to historic status
 */
export class DrawLifecycleService {
  /**
   * Check if a draw should be archived
   */
  async shouldArchive(drawNumber: number): Promise<DrawLifecycleStatus> {
    try {
      const draw = await prisma.draws.findUnique({
        where: { game_type_draw_number: { game_type: 'stryktipset', draw_number: drawNumber } },
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

      // Check if draw status is Completed
      if (draw.status !== 'Completed') {
        return {
          draw_number: drawNumber,
          is_current: true,
          archived_at: null,
          should_archive: false,
          reason: `Status is ${draw.status}, not Completed`,
        }
      }

      // Check if all matches have results
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

      // Should archive
      return {
        draw_number: drawNumber,
        is_current: true,
        archived_at: null,
        should_archive: true,
        reason: 'Draw is completed with all results',
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
   * Archive a draw (set is_current = false)
   */
  async archiveDraw(drawNumber: number): Promise<boolean> {
    try {
      console.log(`[Draw Lifecycle] Archiving draw ${drawNumber}`)

      await prisma.draws.update({
        where: { game_type_draw_number: { game_type: 'stryktipset', draw_number: drawNumber } },
        data: {
          is_current: false,
          archived_at: new Date(),
        },
      })

      console.log(`[Draw Lifecycle] Draw ${drawNumber} archived successfully`)
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

      // Get all current draws
      const currentDraws = await prisma.draws.findMany({
        where: { is_current: true },
        select: { draw_number: true, status: true },
      })

      console.log(`[Draw Lifecycle] Found ${currentDraws.length} current draws`)

      let checked = 0
      let archived = 0
      let errors = 0

      for (const draw of currentDraws) {
        checked++

        // Check if should archive
        const status = await this.shouldArchive(draw.draw_number)

        if (status.should_archive) {
          const success = await this.archiveDraw(draw.draw_number)
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
   * @param force - If true, bypass validation checks and archive regardless of status
   */
  async manualArchiveDraw(
    drawNumber: number,
    force: boolean = false
  ): Promise<{
    success: boolean
    error?: string
    wasForced?: boolean
  }> {
    try {
      const draw = await prisma.draws.findUnique({
        where: { game_type_draw_number: { game_type: 'stryktipset', draw_number: drawNumber } },
        select: {
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

      // If not forcing, validate that draw is completed
      if (!force && draw.status !== 'Completed') {
        return {
          success: false,
          error: `Cannot archive: draw status is "${draw.status}", not "Completed". Use force option to override.`,
        }
      }

      // Log force archive for audit
      if (force && draw.status !== 'Completed') {
        console.warn(
          `[Draw Lifecycle] Force archiving draw ${drawNumber} with status "${draw.status}" (admin override)`
        )
      }

      console.log(
        `[Draw Lifecycle] Manually archiving draw ${drawNumber}${force ? ' (forced)' : ''}`
      )

      await prisma.draws.update({
        where: { game_type_draw_number: { game_type: 'stryktipset', draw_number: drawNumber } },
        data: {
          is_current: false,
          archived_at: new Date(),
        },
      })

      console.log(`[Draw Lifecycle] Draw ${drawNumber} manually archived successfully`)

      return {
        success: true,
        wasForced: force && draw.status !== 'Completed',
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
