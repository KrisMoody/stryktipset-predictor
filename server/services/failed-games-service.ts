import { prisma } from '~/server/utils/prisma'
import { getGameConfig } from '~/server/constants/game-configs'
import type { GameType } from '~/types/game-types'
import type {
  FailedGame,
  FailedGameStatus,
  FailureReason,
  ResolutionType,
  DrawCompletionStatus,
  ManualGameEntryData,
} from '~/types/failed-games'

/**
 * Service for managing failed/missing games within draws
 * Enables tracking, retry, and manual entry for incomplete draw data
 */
class FailedGamesService {
  /**
   * Record a failed game during sync
   */
  async recordFailedGame(
    drawId: number,
    matchNumber: number,
    gameType: GameType,
    reason: FailureReason,
    errorMessage?: string,
    rawErrorData?: unknown
  ): Promise<void> {
    try {
      await prisma.failed_games.upsert({
        where: { draw_id_match_number: { draw_id: drawId, match_number: matchNumber } },
        create: {
          draw_id: drawId,
          match_number: matchNumber,
          game_type: gameType,
          failure_reason: reason,
          error_message: errorMessage || null,
          raw_error_data: rawErrorData ? JSON.parse(JSON.stringify(rawErrorData)) : null,
          status: 'pending',
          retry_count: 0,
        },
        update: {
          failure_reason: reason,
          error_message: errorMessage || null,
          raw_error_data: rawErrorData ? JSON.parse(JSON.stringify(rawErrorData)) : null,
          retry_count: { increment: 1 },
          last_retry_at: new Date(),
        },
      })

      console.log(
        `[FailedGames] Recorded failed game: draw ${drawId}, match ${matchNumber}, reason: ${reason}`
      )
    } catch (error) {
      console.error('[FailedGames] Error recording failed game:', error)
      throw error
    }
  }

  /**
   * Get all failed games for a specific draw
   */
  async getFailedGamesForDraw(drawId: number): Promise<FailedGame[]> {
    const games = await prisma.failed_games.findMany({
      where: { draw_id: drawId },
      orderBy: { match_number: 'asc' },
    })

    return games.map(g => this.mapToFailedGame(g))
  }

  /**
   * Get all pending failed games (for admin dashboard)
   */
  async getPendingFailedGames(gameType?: GameType): Promise<FailedGame[]> {
    const games = await prisma.failed_games.findMany({
      where: {
        status: { in: ['pending', 'retry_scheduled'] },
        ...(gameType && { game_type: gameType }),
      },
      orderBy: [{ created_at: 'desc' }, { match_number: 'asc' }],
      include: {
        draw: {
          select: {
            draw_number: true,
            game_type: true,
            draw_date: true,
            status: true,
          },
        },
      },
    })

    return games.map(g => this.mapToFailedGame(g))
  }

  /**
   * Get a single failed game by ID
   */
  async getFailedGameById(id: number): Promise<FailedGame | null> {
    const game = await prisma.failed_games.findUnique({
      where: { id },
      include: {
        draw: {
          select: {
            draw_number: true,
            game_type: true,
            draw_date: true,
            status: true,
          },
        },
      },
    })

    return game ? this.mapToFailedGame(game) : null
  }

  /**
   * Mark a failed game as resolved
   */
  async markResolved(
    failedGameId: number,
    resolutionType: ResolutionType,
    adminUserId?: string
  ): Promise<void> {
    await prisma.failed_games.update({
      where: { id: failedGameId },
      data: {
        status: 'resolved',
        resolved_at: new Date(),
        resolved_by: adminUserId || null,
        resolution_type: resolutionType,
      },
    })

    console.log(`[FailedGames] Marked game ${failedGameId} as resolved via ${resolutionType}`)
  }

  /**
   * Update status of a failed game
   */
  async updateStatus(failedGameId: number, status: FailedGameStatus): Promise<void> {
    await prisma.failed_games.update({
      where: { id: failedGameId },
      data: { status },
    })
  }

  /**
   * Delete a failed game record (e.g., after successful match creation)
   */
  async deleteFailedGame(drawId: number, matchNumber: number): Promise<void> {
    try {
      await prisma.failed_games.delete({
        where: { draw_id_match_number: { draw_id: drawId, match_number: matchNumber } },
      })
      console.log(`[FailedGames] Deleted failed game record: draw ${drawId}, match ${matchNumber}`)
    } catch {
      // Record might not exist, which is fine
    }
  }

  /**
   * Check if draw is complete (has all required games)
   */
  async checkDrawCompletion(drawId: number): Promise<DrawCompletionStatus> {
    const draw = await prisma.draws.findUnique({
      where: { id: drawId },
      select: {
        id: true,
        draw_number: true,
        game_type: true,
        matches: {
          select: { match_number: true },
        },
        failed_games: {
          where: { status: { not: 'resolved' } },
          select: { match_number: true },
        },
      },
    })

    if (!draw) {
      throw new Error(`Draw ${drawId} not found`)
    }

    const gameType = draw.game_type as GameType
    const config = getGameConfig(gameType)
    const expectedGames = config.matchCount
    const actualGames = draw.matches.length
    const failedGames = draw.failed_games.length

    // Find missing match numbers
    const existingMatchNumbers = new Set(draw.matches.map(m => m.match_number))
    const missingMatchNumbers: number[] = []
    for (let i = 1; i <= expectedGames; i++) {
      if (!existingMatchNumbers.has(i)) {
        missingMatchNumbers.push(i)
      }
    }

    const isComplete = actualGames === expectedGames && failedGames === 0

    return {
      drawId: draw.id,
      drawNumber: draw.draw_number,
      gameType,
      expectedGames,
      actualGames,
      failedGames,
      isComplete,
      canCreateCoupon: isComplete,
      missingMatchNumbers,
    }
  }

  /**
   * Get completion status for all current draws
   */
  async getAllIncompleteDraws(): Promise<DrawCompletionStatus[]> {
    const draws = await prisma.draws.findMany({
      where: { is_current: true },
      select: {
        id: true,
        draw_number: true,
        game_type: true,
        matches: {
          select: { match_number: true },
        },
        failed_games: {
          where: { status: { not: 'resolved' } },
          select: { match_number: true },
        },
      },
      orderBy: { draw_number: 'desc' },
    })

    const results: DrawCompletionStatus[] = []

    for (const draw of draws) {
      const gameType = draw.game_type as GameType
      const config = getGameConfig(gameType)
      const expectedGames = config.matchCount
      const actualGames = draw.matches.length
      const failedGames = draw.failed_games.length

      // Only include incomplete draws
      if (actualGames < expectedGames || failedGames > 0) {
        const existingMatchNumbers = new Set(draw.matches.map(m => m.match_number))
        const missingMatchNumbers: number[] = []
        for (let i = 1; i <= expectedGames; i++) {
          if (!existingMatchNumbers.has(i)) {
            missingMatchNumbers.push(i)
          }
        }

        results.push({
          drawId: draw.id,
          drawNumber: draw.draw_number,
          gameType,
          expectedGames,
          actualGames,
          failedGames,
          isComplete: false,
          canCreateCoupon: false,
          missingMatchNumbers,
        })
      }
    }

    return results
  }

  /**
   * Create a match from manual entry data
   * This is a simplified version - full implementation would need team/league lookup
   */
  async resolveWithManualEntry(
    failedGameId: number,
    _data: ManualGameEntryData,
    adminUserId: string
  ): Promise<{ success: boolean; matchId?: number; error?: string }> {
    try {
      const failedGame = await prisma.failed_games.findUnique({
        where: { id: failedGameId },
        include: {
          draw: {
            select: {
              id: true,
              draw_number: true,
              game_type: true,
            },
          },
        },
      })

      if (!failedGame) {
        return { success: false, error: 'Failed game record not found' }
      }

      // For now, just mark as resolved with manual_entry
      // Full implementation would create the actual match record
      await this.markResolved(failedGameId, 'manual_entry', adminUserId)

      return {
        success: true,
        matchId: undefined, // Would be the created match ID
      }
    } catch (error) {
      console.error('[FailedGames] Error resolving with manual entry:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Map database record to FailedGame type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToFailedGame(record: any): FailedGame {
    return {
      id: record.id,
      drawId: record.draw_id,
      matchNumber: record.match_number,
      gameType: record.game_type as GameType,
      failureReason: record.failure_reason as FailureReason,
      errorMessage: record.error_message,
      retryCount: record.retry_count,
      lastRetryAt: record.last_retry_at,
      status: record.status as FailedGameStatus,
      resolvedAt: record.resolved_at,
      resolvedBy: record.resolved_by,
      resolutionType: record.resolution_type as ResolutionType | null,
      rawErrorData: record.raw_error_data,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    }
  }
}

// Export singleton instance
export const failedGamesService = new FailedGamesService()
