import { prisma } from '~/server/utils/prisma'
import type {
  CouponStatus,
  PersistedCoupon,
  CouponSelection,
  CouponRow,
  MGExtension,
} from '~/types'

interface SaveCouponParams {
  drawNumber: number
  systemId: string | null
  mode: 'ai' | 'r-system' | 'u-system'
  utgangstecken?: Record<number, string> | null
  mgExtensions?: MGExtension[] | null
  selections: CouponSelection[]
  rows: CouponRow[]
  totalCost: number
  expectedValue: number
  budget?: number | null
  performanceId?: number | null
}

export class CouponPersistenceService {
  /**
   * Save a generated coupon and return the persisted data
   * Auto-increments version for same draw/mode/system combination
   */
  async saveCoupon(params: SaveCouponParams): Promise<PersistedCoupon> {
    // Get next version number for this draw/mode/system combination
    const latestCoupon = await prisma.generated_coupons.findFirst({
      where: {
        draw_number: params.drawNumber,
        mode: params.mode,
        system_id: params.systemId,
      },
      orderBy: { version: 'desc' },
    })

    const nextVersion = (latestCoupon?.version ?? 0) + 1

    const saved = await prisma.generated_coupons.create({
      data: {
        draw_number: params.drawNumber,
        system_id: params.systemId,
        mode: params.mode,
        status: 'generated',
        version: nextVersion,
        utgangstecken: params.utgangstecken ? JSON.parse(JSON.stringify(params.utgangstecken)) : null,
        mg_extensions: params.mgExtensions ? JSON.parse(JSON.stringify(params.mgExtensions)) : null,
        selections: JSON.parse(JSON.stringify(params.selections)),
        rows: JSON.parse(JSON.stringify(params.rows)),
        total_cost: params.totalCost,
        expected_value: params.expectedValue,
        budget: params.budget ?? null,
        performance_id: params.performanceId ?? null,
      },
    })

    return this.mapToPersistedCoupon(saved)
  }

  /**
   * Update coupon status with timestamp
   */
  async updateStatus(couponId: number, status: CouponStatus): Promise<PersistedCoupon> {
    const timestampField = this.getTimestampFieldForStatus(status)

    const updated = await prisma.generated_coupons.update({
      where: { id: couponId },
      data: {
        status,
        ...(timestampField && { [timestampField]: new Date() }),
      },
    })

    return this.mapToPersistedCoupon(updated)
  }

  /**
   * Get coupon by ID
   */
  async getCoupon(couponId: number): Promise<PersistedCoupon | null> {
    const coupon = await prisma.generated_coupons.findUnique({
      where: { id: couponId },
    })

    return coupon ? this.mapToPersistedCoupon(coupon) : null
  }

  /**
   * Get all coupons for a draw
   */
  async getCouponsForDraw(drawNumber: number): Promise<PersistedCoupon[]> {
    const coupons = await prisma.generated_coupons.findMany({
      where: { draw_number: drawNumber },
      orderBy: { created_at: 'desc' },
    })

    return coupons.map(c => this.mapToPersistedCoupon(c))
  }

  /**
   * Get coupons by status
   */
  async getCouponsByStatus(status: CouponStatus): Promise<PersistedCoupon[]> {
    const coupons = await prisma.generated_coupons.findMany({
      where: { status },
      orderBy: { created_at: 'desc' },
    })

    return coupons.map(c => this.mapToPersistedCoupon(c))
  }

  /**
   * Get played coupons that haven't been analyzed yet
   */
  async getPlayedCouponsForAnalysis(): Promise<PersistedCoupon[]> {
    const coupons = await prisma.generated_coupons.findMany({
      where: {
        status: 'played',
        analyzed_at: null,
      },
      orderBy: { created_at: 'asc' },
    })

    return coupons.map(c => this.mapToPersistedCoupon(c))
  }

  private getTimestampFieldForStatus(status: CouponStatus): string | null {
    switch (status) {
      case 'saved': return 'saved_at'
      case 'played': return 'played_at'
      case 'analyzed': return 'analyzed_at'
      default: return null
    }
  }

  private mapToPersistedCoupon(record: any): PersistedCoupon {
    return {
      id: record.id,
      drawNumber: record.draw_number,
      systemId: record.system_id,
      mode: record.mode as 'ai' | 'r-system' | 'u-system',
      status: record.status as CouponStatus,
      version: record.version,
      utgangstecken: record.utgangstecken as Record<number, string> | null,
      mgExtensions: record.mg_extensions as MGExtension[] | null,
      selections: record.selections as CouponSelection[],
      rows: record.rows as CouponRow[],
      totalCost: record.total_cost,
      expectedValue: Number(record.expected_value),
      budget: record.budget,
      performanceId: record.performance_id,
      savedAt: record.saved_at,
      playedAt: record.played_at,
      analyzedAt: record.analyzed_at,
      createdAt: record.created_at,
    }
  }
}

export const couponPersistenceService = new CouponPersistenceService()
