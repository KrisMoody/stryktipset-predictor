import { prisma } from '~/server/utils/prisma'
import type { MGExtension, CouponRow } from '~/types'

interface SystemPerformanceRecord {
  drawNumber: number
  systemId: string
  systemType: 'R' | 'U'
  rowsCount: number
  cost: number
  mgExtensions: MGExtension[] | null
  finalRowCount: number
  finalCost: number
  rows: CouponRow[]
}

interface AnalysisResult {
  correctRow: string
  winningRows: number
  bestScore: number
  scoreDistribution: Record<number, number>
  payout: number
  roi: number
}

interface SystemStats {
  systemId: string
  systemType: 'R' | 'U'
  totalDraws: number
  totalCost: number
  totalPayout: number
  roi: number
  avgBestScore: number
  winRate: number // % of draws with 13 rätt
  hitRate10Plus: number // % of draws with 10+ rätt
  hitRate11Plus: number // % of draws with 11+ rätt
  hitRate12Plus: number // % of draws with 12+ rätt
  scoreDistribution: Record<number, number>
}

interface OverallStats {
  totalDrawsAnalyzed: number
  totalCost: number
  totalPayout: number
  overallRoi: number
  bestPerformingSystem: string | null
  worstPerformingSystem: string | null
  avgBestScore: number
  systemTypeComparison: {
    R: { count: number; roi: number; avgScore: number }
    U: { count: number; roi: number; avgScore: number }
  }
}

export class SystemPerformanceAnalyzer {
  /**
   * Record a generated coupon for future performance tracking
   */
  async recordGeneratedCoupon(record: SystemPerformanceRecord): Promise<number> {
    const result = await prisma.system_performance.create({
      data: {
        draw_number: record.drawNumber,
        system_id: record.systemId,
        system_type: record.systemType,
        rows_count: record.rowsCount,
        cost: record.cost,
        mg_extensions: record.mgExtensions
          ? JSON.parse(JSON.stringify(record.mgExtensions))
          : undefined,
        final_row_count: record.finalRowCount,
        final_cost: record.finalCost,
      },
    })

    // Also store the generated coupon for reference
    await prisma.generated_coupons.create({
      data: {
        draw_number: record.drawNumber,
        system_id: record.systemId,
        mode: record.systemType === 'R' ? 'r-system' : 'u-system',
        mg_extensions: record.mgExtensions
          ? JSON.parse(JSON.stringify(record.mgExtensions))
          : undefined,
        selections: [], // Populated separately if needed
        rows: JSON.parse(JSON.stringify(record.rows)),
        total_cost: record.finalCost,
        expected_value: 0, // Calculate separately
        performance_id: result.id,
      },
    })

    return result.id
  }

  /**
   * Analyze a completed draw against stored system performances
   */
  async analyzeCompletedDraw(drawNumber: number): Promise<number> {
    // Get actual match outcomes for this draw
    const draw = await prisma.draws.findFirst({
      where: { draw_number: drawNumber },
      include: {
        matches: {
          orderBy: { match_number: 'asc' },
        },
      },
    })

    if (!draw) {
      throw new Error(`Draw ${drawNumber} not found`)
    }

    // Check if all matches have outcomes
    const outcomes = draw.matches.map(m => m.outcome)
    if (outcomes.some(o => !o)) {
      throw new Error(`Draw ${drawNumber} has incomplete match outcomes`)
    }

    const correctRow = outcomes.join('')

    // Get all recorded performances for this draw that haven't been analyzed
    const performances = await prisma.system_performance.findMany({
      where: {
        draw_number: drawNumber,
        analyzed_at: null,
      },
    })

    let analyzedCount = 0

    for (const perf of performances) {
      // Get the generated coupon rows
      const coupon = await prisma.generated_coupons.findFirst({
        where: { performance_id: perf.id },
      })

      if (!coupon) continue

      const rows = coupon.rows as unknown as CouponRow[]
      const analysis = this.analyzeRows(rows, correctRow)

      // Update performance record with results
      await prisma.system_performance.update({
        where: { id: perf.id },
        data: {
          correct_row: correctRow,
          winning_rows: analysis.winningRows,
          best_score: analysis.bestScore,
          score_distribution: analysis.scoreDistribution,
          payout: analysis.payout,
          roi: analysis.roi,
          analyzed_at: new Date(),
        },
      })

      analyzedCount++
    }

    return analyzedCount
  }

  /**
   * Analyze coupon rows against correct outcome
   */
  private analyzeRows(rows: CouponRow[], correctRow: string): AnalysisResult {
    const scoreDistribution: Record<number, number> = {}
    let winningRows = 0
    let bestScore = 0

    for (const row of rows) {
      const rowStr = row.picks.join('')
      const score = this.calculateScore(rowStr, correctRow)

      bestScore = Math.max(bestScore, score)
      scoreDistribution[score] = (scoreDistribution[score] || 0) + 1

      if (score === 13) {
        winningRows++
      }
    }

    // Calculate payout (simplified - would need actual prize data)
    // For now, estimate based on score
    const payout = this.estimatePayout(scoreDistribution)
    const cost = rows.length
    const roi = cost > 0 ? ((payout - cost) / cost) * 100 : 0

    return {
      correctRow,
      winningRows,
      bestScore,
      scoreDistribution,
      payout,
      roi,
    }
  }

  /**
   * Calculate how many outcomes match
   */
  private calculateScore(rowStr: string, correctRow: string): number {
    let score = 0
    for (let i = 0; i < 13; i++) {
      if (rowStr[i] === correctRow[i]) {
        score++
      }
    }
    return score
  }

  /**
   * Estimate payout based on score distribution
   * This is simplified - real payouts depend on pool size and winners
   */
  private estimatePayout(scoreDistribution: Record<number, number>): number {
    // Average payouts (very rough estimates based on historical data)
    const avgPayouts: Record<number, number> = {
      13: 1000000, // Jackpot - highly variable
      12: 5000,
      11: 200,
      10: 20,
    }

    let totalPayout = 0
    for (const [score, count] of Object.entries(scoreDistribution)) {
      const scoreNum = parseInt(score)
      if (avgPayouts[scoreNum]) {
        totalPayout += avgPayouts[scoreNum] * count
      }
    }

    return totalPayout
  }

  /**
   * Get performance statistics for a specific system
   */
  async getSystemStats(systemId: string): Promise<SystemStats | null> {
    const performances = await prisma.system_performance.findMany({
      where: {
        system_id: systemId,
        analyzed_at: { not: null },
      },
    })

    if (performances.length === 0) return null

    const totalDraws = performances.length
    const totalCost = performances.reduce((sum, p) => sum + p.final_cost, 0)
    const totalPayout = performances.reduce((sum, p) => sum + Number(p.payout || 0), 0)

    const bestScores = performances.map(p => p.best_score || 0)
    const avgBestScore = bestScores.reduce((a, b) => a + b, 0) / totalDraws

    const wins = performances.filter(p => (p.winning_rows || 0) > 0).length
    const hits10 = performances.filter(p => (p.best_score || 0) >= 10).length
    const hits11 = performances.filter(p => (p.best_score || 0) >= 11).length
    const hits12 = performances.filter(p => (p.best_score || 0) >= 12).length

    // Aggregate score distribution
    const scoreDistribution: Record<number, number> = {}
    for (const perf of performances) {
      const dist = perf.score_distribution as Record<number, number> | null
      if (dist) {
        for (const [score, count] of Object.entries(dist)) {
          scoreDistribution[parseInt(score)] = (scoreDistribution[parseInt(score)] || 0) + count
        }
      }
    }

    return {
      systemId,
      systemType: (performances[0]?.system_type ?? 'R') as 'R' | 'U',
      totalDraws,
      totalCost,
      totalPayout,
      roi: totalCost > 0 ? ((totalPayout - totalCost) / totalCost) * 100 : 0,
      avgBestScore,
      winRate: (wins / totalDraws) * 100,
      hitRate10Plus: (hits10 / totalDraws) * 100,
      hitRate11Plus: (hits11 / totalDraws) * 100,
      hitRate12Plus: (hits12 / totalDraws) * 100,
      scoreDistribution,
    }
  }

  /**
   * Get overall performance statistics
   */
  async getOverallStats(): Promise<OverallStats> {
    const performances = await prisma.system_performance.findMany({
      where: { analyzed_at: { not: null } },
    })

    if (performances.length === 0) {
      return {
        totalDrawsAnalyzed: 0,
        totalCost: 0,
        totalPayout: 0,
        overallRoi: 0,
        bestPerformingSystem: null,
        worstPerformingSystem: null,
        avgBestScore: 0,
        systemTypeComparison: {
          R: { count: 0, roi: 0, avgScore: 0 },
          U: { count: 0, roi: 0, avgScore: 0 },
        },
      }
    }

    const totalDraws = new Set(performances.map(p => p.draw_number)).size
    const totalCost = performances.reduce((sum, p) => sum + p.final_cost, 0)
    const totalPayout = performances.reduce((sum, p) => sum + Number(p.payout || 0), 0)
    const avgBestScore =
      performances.reduce((sum, p) => sum + (p.best_score || 0), 0) / performances.length

    // Group by system for comparison
    const bySystem: Record<string, typeof performances> = {}
    for (const perf of performances) {
      if (!bySystem[perf.system_id]) bySystem[perf.system_id] = []
      bySystem[perf.system_id]!.push(perf)
    }

    // Find best/worst performing systems
    let bestSystem: string | null = null
    let bestRoi = -Infinity
    let worstSystem: string | null = null
    let worstRoi = Infinity

    for (const [systemId, perfs] of Object.entries(bySystem)) {
      const sysCost = perfs.reduce((s, p) => s + p.final_cost, 0)
      const sysPayout = perfs.reduce((s, p) => s + Number(p.payout || 0), 0)
      const sysRoi = sysCost > 0 ? ((sysPayout - sysCost) / sysCost) * 100 : 0

      if (sysRoi > bestRoi) {
        bestRoi = sysRoi
        bestSystem = systemId
      }
      if (sysRoi < worstRoi) {
        worstRoi = sysRoi
        worstSystem = systemId
      }
    }

    // System type comparison
    const rPerfs = performances.filter(p => p.system_type === 'R')
    const uPerfs = performances.filter(p => p.system_type === 'U')

    const rCost = rPerfs.reduce((s, p) => s + p.final_cost, 0)
    const rPayout = rPerfs.reduce((s, p) => s + Number(p.payout || 0), 0)
    const uCost = uPerfs.reduce((s, p) => s + p.final_cost, 0)
    const uPayout = uPerfs.reduce((s, p) => s + Number(p.payout || 0), 0)

    return {
      totalDrawsAnalyzed: totalDraws,
      totalCost,
      totalPayout,
      overallRoi: totalCost > 0 ? ((totalPayout - totalCost) / totalCost) * 100 : 0,
      bestPerformingSystem: bestSystem,
      worstPerformingSystem: worstSystem,
      avgBestScore,
      systemTypeComparison: {
        R: {
          count: rPerfs.length,
          roi: rCost > 0 ? ((rPayout - rCost) / rCost) * 100 : 0,
          avgScore:
            rPerfs.length > 0
              ? rPerfs.reduce((s, p) => s + (p.best_score || 0), 0) / rPerfs.length
              : 0,
        },
        U: {
          count: uPerfs.length,
          roi: uCost > 0 ? ((uPayout - uCost) / uCost) * 100 : 0,
          avgScore:
            uPerfs.length > 0
              ? uPerfs.reduce((s, p) => s + (p.best_score || 0), 0) / uPerfs.length
              : 0,
        },
      },
    }
  }

  /**
   * Get performance trend over time
   */
  async getPerformanceTrend(
    systemId?: string,
    limit: number = 20
  ): Promise<
    Array<{
      drawNumber: number
      systemId: string
      bestScore: number
      roi: number
      createdAt: Date
    }>
  > {
    const where: { analyzed_at: { not: null }; system_id?: string } = { analyzed_at: { not: null } }
    if (systemId) where.system_id = systemId

    const performances = await prisma.system_performance.findMany({
      where,
      orderBy: { draw_number: 'desc' },
      take: limit,
    })

    return performances.map(p => ({
      drawNumber: p.draw_number,
      systemId: p.system_id,
      bestScore: p.best_score || 0,
      roi: Number(p.roi || 0),
      createdAt: p.created_at,
    }))
  }

  /**
   * Compare multiple systems performance
   */
  async compareSystems(systemIds: string[]): Promise<SystemStats[]> {
    const stats: SystemStats[] = []

    for (const systemId of systemIds) {
      const systemStats = await this.getSystemStats(systemId)
      if (systemStats) {
        stats.push(systemStats)
      }
    }

    return stats.sort((a, b) => b.roi - a.roi)
  }

  /**
   * Get leaderboard of best performing systems
   */
  async getLeaderboard(limit: number = 10): Promise<
    Array<{
      systemId: string
      systemType: 'R' | 'U'
      drawsPlayed: number
      roi: number
      avgBestScore: number
    }>
  > {
    const performances = await prisma.system_performance.findMany({
      where: { analyzed_at: { not: null } },
    })

    // Group by system
    const bySystem: Record<string, typeof performances> = {}
    for (const perf of performances) {
      if (!bySystem[perf.system_id]) bySystem[perf.system_id] = []
      bySystem[perf.system_id]!.push(perf)
    }

    // Calculate stats per system
    const systemStats: Array<{
      systemId: string
      systemType: 'R' | 'U'
      drawsPlayed: number
      roi: number
      avgBestScore: number
    }> = []

    for (const [systemId, perfs] of Object.entries(bySystem)) {
      const cost = perfs.reduce((s, p) => s + p.final_cost, 0)
      const payout = perfs.reduce((s, p) => s + Number(p.payout || 0), 0)
      const avgScore = perfs.reduce((s, p) => s + (p.best_score || 0), 0) / perfs.length

      systemStats.push({
        systemId,
        systemType: (perfs[0]?.system_type ?? 'R') as 'R' | 'U',
        drawsPlayed: perfs.length,
        roi: cost > 0 ? ((payout - cost) / cost) * 100 : 0,
        avgBestScore: avgScore,
      })
    }

    // Sort by ROI descending
    return systemStats.sort((a, b) => b.roi - a.roi).slice(0, limit)
  }
}

// Export singleton instance
export const systemPerformanceAnalyzer = new SystemPerformanceAnalyzer()
