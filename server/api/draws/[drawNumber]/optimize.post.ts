import { couponOptimizer } from '~/server/services/coupon-optimizer'
import { couponOptimizerV2 } from '~/server/services/coupon-optimizer-v2'
import { couponPersistenceService } from '~/server/services/coupon-persistence'

export default defineEventHandler(async (event) => {
  try {
    const drawNumber = parseInt(event.context.params?.drawNumber || '0')
    const body = await readBody(event)
    const { mode, systemId, utgangstecken, mgExtensions, budget } = body

    // System-based optimization (R or U-system)
    if (mode === 'system' && systemId) {
      const coupon = await couponOptimizerV2.generateSystemCoupon(
        drawNumber,
        systemId,
        utgangstecken,
        mgExtensions,
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
        systemId: coupon.system.id,
        mode: coupon.system.type === 'R' ? 'r-system' : 'u-system',
        utgangstecken: coupon.utgangstecken,
        mgExtensions: mgExtensions || null,
        selections: coupon.selections,
        rows: coupon.rows,
        totalCost: coupon.totalCost,
        expectedValue: coupon.expectedValue,
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
      }
    }

    // AI-based optimization (existing logic)
    const coupon = await couponOptimizer.generateOptimalCoupon(drawNumber, budget || 500)

    if (!coupon) {
      throw createError({
        statusCode: 500,
        message: 'Failed to generate optimal coupon',
      })
    }

    // Auto-save the AI coupon
    const persistedCoupon = await couponPersistenceService.saveCoupon({
      drawNumber,
      systemId: null,
      mode: 'ai',
      selections: coupon.selections,
      rows: [],
      totalCost: coupon.totalCost,
      expectedValue: coupon.expectedValue,
      budget: budget || 500,
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
    }
  }
  catch (error) {
    console.error('Error optimizing coupon:', error)
    throw error
  }
})
