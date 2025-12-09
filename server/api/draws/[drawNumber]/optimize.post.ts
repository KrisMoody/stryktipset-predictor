import { couponOptimizer, type TopptipsetStake } from '~/server/services/coupon-optimizer'
import { couponOptimizerV2 } from '~/server/services/coupon-optimizer-v2'
import { couponPersistenceService } from '~/server/services/coupon-persistence'
import type { GameType } from '~/types/game-types'
import { isValidGameType, DEFAULT_GAME_TYPE } from '~/server/constants/game-configs'

export default defineEventHandler(async event => {
  try {
    const drawNumber = parseInt(event.context.params?.drawNumber || '0')
    const body = await readBody(event)
    const { mode, systemId, utgangstecken, mgExtensions, budget, stake } = body

    // Extract and validate gameType
    const gameTypeParam = body.gameType as string | undefined
    const gameType: GameType =
      gameTypeParam && isValidGameType(gameTypeParam) ? gameTypeParam : DEFAULT_GAME_TYPE

    // Validate stake for Topptipset (1, 2, 5, or 10 SEK)
    const validStake: TopptipsetStake = [1, 2, 5, 10].includes(stake) ? stake : 1

    // System-based optimization (R or U-system)
    if (mode === 'system' && systemId) {
      const coupon = await couponOptimizerV2.generateSystemCoupon(
        drawNumber,
        systemId,
        utgangstecken,
        mgExtensions,
        gameType,
        validStake
      )

      if (!coupon) {
        throw createError({
          statusCode: 500,
          message: 'Failed to generate system coupon',
        })
      }

      // Auto-save the system coupon
      const persistedCoupon = await couponPersistenceService.saveCoupon({
        drawNumber,
        gameType,
        systemId: coupon.system.id,
        mode: coupon.system.type === 'R' ? 'r-system' : 'u-system',
        utgangstecken: coupon.utgangstecken,
        mgExtensions: mgExtensions || null,
        selections: coupon.selections,
        rows: coupon.rows,
        totalCost: coupon.totalCost,
        expectedValue: coupon.expectedValue,
        stake: validStake,
      })

      return {
        success: true,
        coupon: {
          ...coupon,
          id: persistedCoupon.id,
          status: persistedCoupon.status,
          version: persistedCoupon.version,
        },
        mode: 'system',
        gameType,
      }
    }

    // AI-based optimization (existing logic)
    const coupon = await couponOptimizer.generateOptimalCoupon(
      drawNumber,
      budget || 500,
      gameType,
      validStake
    )

    if (!coupon) {
      throw createError({
        statusCode: 500,
        message: 'Failed to generate optimal coupon',
      })
    }

    // Auto-save the AI coupon
    const persistedCoupon = await couponPersistenceService.saveCoupon({
      drawNumber,
      gameType,
      systemId: null,
      mode: 'ai',
      selections: coupon.selections,
      rows: [],
      totalCost: coupon.totalCost,
      expectedValue: coupon.expectedValue,
      budget: budget || 500,
      stake: validStake,
    })

    return {
      success: true,
      coupon: {
        ...coupon,
        id: persistedCoupon.id,
        status: persistedCoupon.status,
        version: persistedCoupon.version,
      },
      mode: 'ai',
      gameType,
    }
  } catch (error) {
    console.error('Error optimizing coupon:', error)
    throw error
  }
})
