import { prisma } from '~/server/utils/prisma'
import type {
  AIMetricsOverview,
  ModelCostBreakdown,
  OperationCostBreakdown,
  CostTrends,
  CostTrendDataPoint,
  TokenEfficiencyMetrics,
  BudgetAnalysis,
  OptimizationRecommendation,
  DateRangeFilter,
} from '~/types'
import { AI_PRICING } from '~/server/constants/ai-pricing'

/* eslint-disable @typescript-eslint/no-explicit-any -- Raw SQL queries return dynamic types */

/**
 * Service for analyzing AI usage and costs
 */
export class AIMetricsService {
  /**
   * Get overall AI metrics summary
   */
  async getOverallStats(dateRange?: DateRangeFilter): Promise<AIMetricsOverview> {
    const whereClause = this.buildDateWhereClause(dateRange)

    const [stats, successStats] = await Promise.all([
      prisma.ai_usage.aggregate({
        where: whereClause,
        _sum: {
          input_tokens: true,
          output_tokens: true,
          cost_usd: true,
          duration_ms: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.ai_usage.aggregate({
        where: {
          ...whereClause,
          success: true,
        },
        _count: {
          id: true,
        },
      }),
    ])

    const totalTokens = (stats._sum.input_tokens || 0) + (stats._sum.output_tokens || 0)
    const totalRequests = stats._count.id || 0
    const successfulRequests = successStats._count.id || 0

    return {
      totalCost: Number(stats._sum.cost_usd || 0),
      totalTokens,
      totalInputTokens: stats._sum.input_tokens || 0,
      totalOutputTokens: stats._sum.output_tokens || 0,
      totalRequests,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      averageCostPerRequest:
        totalRequests > 0 ? Number(stats._sum.cost_usd || 0) / totalRequests : 0,
      averageDuration: totalRequests > 0 ? (stats._sum.duration_ms || 0) / totalRequests : 0,
      dateRange: this.getDateRangeValues(dateRange),
    }
  }

  /**
   * Get cost breakdown by AI model
   */
  async getCostsByModel(dateRange?: DateRangeFilter): Promise<ModelCostBreakdown[]> {
    const whereClause = this.buildDateWhereClause(dateRange)

    const modelStats = await prisma.ai_usage.groupBy({
      by: ['model'],
      where: whereClause,
      _sum: {
        input_tokens: true,
        output_tokens: true,
        cost_usd: true,
      },
      _count: {
        id: true,
      },
    })

    const modelSuccessStats = await prisma.ai_usage.groupBy({
      by: ['model'],
      where: {
        ...whereClause,
        success: true,
      },
      _count: {
        id: true,
      },
    })

    const successMap = new Map(modelSuccessStats.map(s => [s.model, s._count.id]))

    return modelStats
      .map(stat => {
        const inputTokens = stat._sum.input_tokens || 0
        const outputTokens = stat._sum.output_tokens || 0
        const totalTokens = inputTokens + outputTokens
        const requests = stat._count.id
        const successfulRequests = successMap.get(stat.model) || 0
        const pricing = Object.values(AI_PRICING).find(p => p.model === stat.model)

        return {
          model: stat.model,
          requests,
          inputTokens,
          outputTokens,
          totalTokens,
          totalCost: Number(stat._sum.cost_usd || 0),
          averageCostPerRequest: requests > 0 ? Number(stat._sum.cost_usd || 0) / requests : 0,
          successRate: requests > 0 ? (successfulRequests / requests) * 100 : 0,
          description: pricing?.description,
        }
      })
      .sort((a, b) => b.totalCost - a.totalCost)
  }

  /**
   * Get cost breakdown by operation type
   */
  async getCostsByDataType(dateRange?: DateRangeFilter): Promise<OperationCostBreakdown[]> {
    const whereClause = this.buildDateWhereClause(dateRange)

    const typeStats = await prisma.ai_usage.groupBy({
      by: ['data_type'],
      where: {
        ...whereClause,
        data_type: { not: null },
      },
      _sum: {
        input_tokens: true,
        output_tokens: true,
        cost_usd: true,
      },
      _count: {
        id: true,
      },
    })

    const typeSuccessStats = await prisma.ai_usage.groupBy({
      by: ['data_type'],
      where: {
        ...whereClause,
        data_type: { not: null },
        success: true,
      },
      _count: {
        id: true,
      },
    })

    const successMap = new Map(typeSuccessStats.map(s => [s.data_type, s._count.id]))

    return typeStats
      .filter(stat => stat.data_type !== null)
      .map(stat => {
        const inputTokens = stat._sum.input_tokens || 0
        const outputTokens = stat._sum.output_tokens || 0
        const totalTokens = inputTokens + outputTokens
        const requests = stat._count.id
        const successfulRequests = successMap.get(stat.data_type) || 0

        return {
          dataType: stat.data_type!,
          requests,
          inputTokens,
          outputTokens,
          totalTokens,
          totalCost: Number(stat._sum.cost_usd || 0),
          averageCostPerRequest: requests > 0 ? Number(stat._sum.cost_usd || 0) / requests : 0,
          averageTokensPerRequest: requests > 0 ? totalTokens / requests : 0,
          successRate: requests > 0 ? (successfulRequests / requests) * 100 : 0,
        }
      })
      .sort((a, b) => b.totalCost - a.totalCost)
  }

  /**
   * Get cost trends over time
   */
  async getCostTrends(dateRange?: DateRangeFilter): Promise<CostTrends> {
    const whereClause = this.buildDateWhereClause(dateRange)
    const hasDateFilter = whereClause.timestamp !== undefined

    // Get daily trends
    const dailyData = hasDateFilter
      ? await prisma.$queryRaw<any[]>`
          SELECT 
            DATE(timestamp) as date,
            SUM(cost_usd)::numeric as cost,
            SUM(input_tokens + output_tokens) as tokens,
            COUNT(*) as requests,
            (COUNT(*) FILTER (WHERE success = true)::numeric / COUNT(*)::numeric * 100) as success_rate
          FROM ai_usage
          WHERE timestamp >= ${whereClause.timestamp.gte} AND timestamp <= ${whereClause.timestamp.lte}
          GROUP BY DATE(timestamp)
          ORDER BY date ASC
        `
      : await prisma.$queryRaw<any[]>`
          SELECT 
            DATE(timestamp) as date,
            SUM(cost_usd)::numeric as cost,
            SUM(input_tokens + output_tokens) as tokens,
            COUNT(*) as requests,
            (COUNT(*) FILTER (WHERE success = true)::numeric / COUNT(*)::numeric * 100) as success_rate
          FROM ai_usage
          GROUP BY DATE(timestamp)
          ORDER BY date ASC
        `

    // Get weekly trends (group by week)
    const weeklyData = hasDateFilter
      ? await prisma.$queryRaw<any[]>`
          SELECT 
            DATE_TRUNC('week', timestamp)::date as date,
            SUM(cost_usd)::numeric as cost,
            SUM(input_tokens + output_tokens) as tokens,
            COUNT(*) as requests,
            (COUNT(*) FILTER (WHERE success = true)::numeric / COUNT(*)::numeric * 100) as success_rate
          FROM ai_usage
          WHERE timestamp >= ${whereClause.timestamp.gte} AND timestamp <= ${whereClause.timestamp.lte}
          GROUP BY DATE_TRUNC('week', timestamp)
          ORDER BY date ASC
        `
      : await prisma.$queryRaw<any[]>`
          SELECT 
            DATE_TRUNC('week', timestamp)::date as date,
            SUM(cost_usd)::numeric as cost,
            SUM(input_tokens + output_tokens) as tokens,
            COUNT(*) as requests,
            (COUNT(*) FILTER (WHERE success = true)::numeric / COUNT(*)::numeric * 100) as success_rate
          FROM ai_usage
          GROUP BY DATE_TRUNC('week', timestamp)
          ORDER BY date ASC
        `

    // Get monthly trends
    const monthlyData = hasDateFilter
      ? await prisma.$queryRaw<any[]>`
          SELECT 
            DATE_TRUNC('month', timestamp)::date as date,
            SUM(cost_usd)::numeric as cost,
            SUM(input_tokens + output_tokens) as tokens,
            COUNT(*) as requests,
            (COUNT(*) FILTER (WHERE success = true)::numeric / COUNT(*)::numeric * 100) as success_rate
          FROM ai_usage
          WHERE timestamp >= ${whereClause.timestamp.gte} AND timestamp <= ${whereClause.timestamp.lte}
          GROUP BY DATE_TRUNC('month', timestamp)
          ORDER BY date ASC
        `
      : await prisma.$queryRaw<any[]>`
          SELECT 
            DATE_TRUNC('month', timestamp)::date as date,
            SUM(cost_usd)::numeric as cost,
            SUM(input_tokens + output_tokens) as tokens,
            COUNT(*) as requests,
            (COUNT(*) FILTER (WHERE success = true)::numeric / COUNT(*)::numeric * 100) as success_rate
          FROM ai_usage
          GROUP BY DATE_TRUNC('month', timestamp)
          ORDER BY date ASC
        `

    return {
      daily: dailyData.map(d => this.formatTrendDataPoint(d)),
      weekly: weeklyData.map(d => this.formatTrendDataPoint(d)),
      monthly: monthlyData.map(d => this.formatTrendDataPoint(d)),
    }
  }

  /**
   * Get token efficiency metrics
   */
  async getTokenEfficiency(dateRange?: DateRangeFilter): Promise<TokenEfficiencyMetrics> {
    const whereClause = this.buildDateWhereClause(dateRange)

    // Get averages by data type
    const [predictionStats, scrapeStats, embeddingStats, mostExpensive] = await Promise.all([
      prisma.ai_usage.aggregate({
        where: {
          ...whereClause,
          data_type: 'prediction',
        },
        _avg: {
          input_tokens: true,
          output_tokens: true,
          cost_usd: true,
        },
      }),
      prisma.ai_usage.aggregate({
        where: {
          ...whereClause,
          data_type: { in: ['xStats', 'statistics', 'headToHead', 'news'] },
        },
        _avg: {
          input_tokens: true,
          output_tokens: true,
          cost_usd: true,
        },
      }),
      prisma.ai_usage.aggregate({
        where: {
          ...whereClause,
          data_type: 'embedding',
        },
        _avg: {
          input_tokens: true,
          output_tokens: true,
          cost_usd: true,
        },
      }),
      prisma.ai_usage.findMany({
        where: whereClause,
        orderBy: {
          cost_usd: 'desc',
        },
        take: 10,
        select: {
          operation_id: true,
          data_type: true,
          model: true,
          cost_usd: true,
          input_tokens: true,
          output_tokens: true,
          timestamp: true,
        },
      }),
    ])

    return {
      averageTokensPerPrediction:
        (predictionStats._avg.input_tokens || 0) + (predictionStats._avg.output_tokens || 0),
      averageTokensPerScrape:
        (scrapeStats._avg.input_tokens || 0) + (scrapeStats._avg.output_tokens || 0),
      averageTokensPerEmbedding:
        (embeddingStats._avg.input_tokens || 0) + (embeddingStats._avg.output_tokens || 0),
      costPerPrediction: Number(predictionStats._avg.cost_usd || 0),
      costPerScrape: Number(scrapeStats._avg.cost_usd || 0),
      costPerEmbedding: Number(embeddingStats._avg.cost_usd || 0),
      mostExpensiveOperations: mostExpensive.map(op => ({
        operationId: op.operation_id || 'unknown',
        dataType: op.data_type || 'unknown',
        model: op.model,
        cost: Number(op.cost_usd),
        tokens: op.input_tokens + op.output_tokens,
        timestamp: op.timestamp,
      })),
    }
  }

  /**
   * Get budget analysis
   */
  async getBudgetAnalysis(): Promise<BudgetAnalysis> {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

    const [currentMonth, lastMonth] = await Promise.all([
      prisma.ai_usage.aggregate({
        where: {
          timestamp: {
            gte: startOfMonth,
          },
        },
        _sum: {
          cost_usd: true,
        },
      }),
      prisma.ai_usage.aggregate({
        where: {
          timestamp: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
        _sum: {
          cost_usd: true,
        },
      }),
    ])

    const currentMonthSpending = Number(currentMonth._sum.cost_usd || 0)
    const lastMonthSpending = Number(lastMonth._sum.cost_usd || 0)

    // Calculate daily average and projection
    const daysElapsed =
      Math.floor((now.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const remainingDays = daysInMonth - daysElapsed
    const dailyAverage = currentMonthSpending / daysElapsed
    const projectedMonthlySpending = dailyAverage * daysInMonth

    // Calculate trend
    const percentageChange =
      lastMonthSpending > 0
        ? ((currentMonthSpending - lastMonthSpending) / lastMonthSpending) * 100
        : 0

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (Math.abs(percentageChange) > 10) {
      trend = percentageChange > 0 ? 'increasing' : 'decreasing'
    }

    return {
      currentMonthSpending,
      lastMonthSpending,
      projectedMonthlySpending,
      dailyAverageSpending: dailyAverage,
      remainingDaysInMonth: remainingDays,
      percentageChange,
      trend,
    }
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations(
    dateRange?: DateRangeFilter
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = []
    const whereClause = this.buildDateWhereClause(dateRange)

    // Check for high failure rates
    const failureRate = await prisma.ai_usage.aggregate({
      where: {
        ...whereClause,
        success: false,
      },
      _count: {
        id: true,
      },
    })

    const totalRequests = await prisma.ai_usage.count({
      where: whereClause,
    })

    const failurePercentage = totalRequests > 0 ? (failureRate._count.id / totalRequests) * 100 : 0

    if (failurePercentage > 5) {
      recommendations.push({
        id: 'high-failure-rate',
        type: 'performance',
        severity: 'high',
        title: 'High AI Request Failure Rate',
        description: `${failurePercentage.toFixed(1)}% of AI requests are failing. This indicates potential issues with API connectivity or rate limiting.`,
        action: 'Review error logs and implement better retry logic or backoff strategies.',
      })
    }

    // Check for expensive operations
    const efficiency = await this.getTokenEfficiency(dateRange)
    if (efficiency.costPerScrape > 0.01) {
      const potentialSavings = efficiency.costPerScrape * 0.3 // Assume 30% reduction possible
      recommendations.push({
        id: 'optimize-scraping',
        type: 'cost',
        severity: 'medium',
        title: 'High Scraping Costs',
        description: `Average scraping cost is $${efficiency.costPerScrape.toFixed(4)} per operation. Consider optimizing prompts or reducing token usage.`,
        potentialSavings,
        action: 'Review and optimize scraping prompts to reduce token consumption.',
      })
    }

    // Check for embedding reuse
    const embeddingCount = await prisma.ai_usage.count({
      where: {
        ...whereClause,
        data_type: 'embedding',
      },
    })

    if (embeddingCount > 100) {
      recommendations.push({
        id: 'cache-embeddings',
        type: 'efficiency',
        severity: 'low',
        title: 'Consider Embedding Caching',
        description:
          'You have generated many embeddings. Consider caching frequently accessed embeddings to reduce costs.',
        action: "Implement a caching layer for match embeddings that haven't changed.",
      })
    }

    // Check budget trends
    const budget = await this.getBudgetAnalysis()
    if (budget.trend === 'increasing' && budget.percentageChange > 50) {
      recommendations.push({
        id: 'increasing-costs',
        type: 'cost',
        severity: 'high',
        title: 'Rapidly Increasing AI Costs',
        description: `AI costs have increased by ${budget.percentageChange.toFixed(1)}% compared to last month. Projected monthly spending: $${budget.projectedMonthlySpending.toFixed(2)}`,
        action: 'Review recent changes in AI usage patterns and optimize high-cost operations.',
      })
    }

    // Positive feedback
    if (failurePercentage < 2 && efficiency.costPerPrediction < 0.05) {
      recommendations.push({
        id: 'efficient-operations',
        type: 'info',
        severity: 'low',
        title: 'AI Operations Running Efficiently',
        description:
          'Your AI operations have a low failure rate and reasonable costs. Keep up the good work!',
        action: 'Continue monitoring for any changes in usage patterns.',
      })
    }

    return recommendations
  }

  /**
   * Build date where clause for queries
   */
  private buildDateWhereClause(dateRange?: DateRangeFilter): any {
    if (!dateRange) {
      return {}
    }

    return {
      timestamp: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    }
  }

  /**
   * Get date range values from filter
   */
  private getDateRangeValues(dateRange?: DateRangeFilter): { start: Date; end: Date } {
    if (!dateRange) {
      // Default to all time - find earliest record
      const now = new Date()
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 3, 1), // 3 months ago as default
        end: now,
      }
    }

    return {
      start: dateRange.start,
      end: dateRange.end,
    }
  }

  /**
   * Format trend data point
   */
  private formatTrendDataPoint(data: any): CostTrendDataPoint {
    return {
      date: data.date.toISOString().split('T')[0],
      cost: Number(data.cost || 0),
      tokens: Number(data.tokens || 0),
      requests: Number(data.requests || 0),
      successRate: Number(data.success_rate || 0),
    }
  }
}

// Export singleton instance
export const aiMetricsService = new AIMetricsService()
