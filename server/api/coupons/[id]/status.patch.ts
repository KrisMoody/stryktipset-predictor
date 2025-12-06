import { couponPersistenceService } from '~/server/services/coupon-persistence'
import type { CouponStatus } from '~/types'

export default defineEventHandler(async event => {
  const couponId = parseInt(event.context.params?.id || '0')

  if (!couponId) {
    throw createError({
      statusCode: 400,
      message: 'Coupon ID is required',
    })
  }

  const body = await readBody(event)
  const { status } = body as { status: CouponStatus }

  const validStatuses: CouponStatus[] = ['generated', 'saved', 'played', 'analyzed']
  if (!status || !validStatuses.includes(status)) {
    throw createError({
      statusCode: 400,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    })
  }

  try {
    const updatedCoupon = await couponPersistenceService.updateStatus(couponId, status)

    return {
      success: true,
      coupon: updatedCoupon,
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error(`Failed to update coupon ${couponId} status:`, error)
    throw createError({
      statusCode: 500,
      message: 'Failed to update coupon status',
      data: { error: err.message },
    })
  }
})
