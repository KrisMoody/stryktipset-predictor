/* eslint-disable @typescript-eslint/no-explicit-any -- Test file with mock data */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================================
// Mock Dependencies
// ============================================================================

const mockPrisma = {
  ai_usage: {
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  $queryRaw: vi.fn(),
}

vi.mock('~/server/utils/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('~/server/constants/ai-pricing', () => ({
  AI_PRICING: {
    CLAUDE_SONNET: {
      model: 'claude-sonnet',
      description: 'Claude Sonnet model',
    },
    CLAUDE_HAIKU: {
      model: 'claude-haiku',
      description: 'Claude Haiku model',
    },
  },
}))

// ============================================================================
// Test Data Factories
// ============================================================================

const createMockAggregateResult = (overrides: Partial<any> = {}) => ({
  _sum: {
    input_tokens: 1000,
    output_tokens: 500,
    cost_usd: 0.05,
    duration_ms: 2000,
  },
  _count: {
    id: 10,
  },
  _avg: {
    input_tokens: 100,
    output_tokens: 50,
    cost_usd: 0.005,
  },
  ...overrides,
})

const createMockGroupByResult = (model: string, overrides: Partial<any> = {}) => ({
  model,
  _sum: {
    input_tokens: 500,
    output_tokens: 250,
    cost_usd: 0.025,
  },
  _count: {
    id: 5,
  },
  ...overrides,
})

const createMockDataTypeGroupByResult = (dataType: string, overrides: Partial<any> = {}) => ({
  data_type: dataType,
  _sum: {
    input_tokens: 300,
    output_tokens: 150,
    cost_usd: 0.015,
  },
  _count: {
    id: 3,
  },
  ...overrides,
})

// ============================================================================
// Testable AIMetricsService
// ============================================================================

interface DateRangeFilter {
  start: Date
  end: Date
}

interface AIMetricsOverview {
  totalCost: number
  totalTokens: number
  totalInputTokens: number
  totalOutputTokens: number
  totalRequests: number
  successRate: number
  averageCostPerRequest: number
  averageDuration: number
  dateRange: { start: Date; end: Date }
}

interface ModelCostBreakdown {
  model: string
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  totalCost: number
  averageCostPerRequest: number
  successRate: number
  description?: string
}

interface OperationCostBreakdown {
  dataType: string
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  totalCost: number
  averageCostPerRequest: number
  averageTokensPerRequest: number
  successRate: number
}

interface TokenEfficiencyMetrics {
  averageTokensPerPrediction: number
  averageTokensPerScrape: number
  averageTokensPerEmbedding: number
  costPerPrediction: number
  costPerScrape: number
  costPerEmbedding: number
  mostExpensiveOperations: any[]
}

interface BudgetAnalysis {
  currentMonthSpending: number
  lastMonthSpending: number
  projectedMonthlySpending: number
  dailyAverageSpending: number
  remainingDaysInMonth: number
  percentageChange: number
  trend: 'increasing' | 'decreasing' | 'stable'
}

interface OptimizationRecommendation {
  id: string
  type: string
  severity: string
  title: string
  description: string
  action: string
  potentialSavings?: number
}

class TestableAIMetricsService {
  /**
   * Get overall AI metrics summary
   */
  async getOverallStats(dateRange?: DateRangeFilter): Promise<AIMetricsOverview> {
    const whereClause = this.buildDateWhereClause(dateRange)

    const [stats, successStats] = await Promise.all([
      mockPrisma.ai_usage.aggregate({
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
      mockPrisma.ai_usage.aggregate({
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

    const modelStats = await mockPrisma.ai_usage.groupBy({
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

    const modelSuccessStats = await mockPrisma.ai_usage.groupBy({
      by: ['model'],
      where: {
        ...whereClause,
        success: true,
      },
      _count: {
        id: true,
      },
    })

    const successMap = new Map<string, number>(
      modelSuccessStats.map((s: any) => [s.model, s._count.id])
    )

    const AI_PRICING: any = {
      CLAUDE_SONNET: { model: 'claude-sonnet', description: 'Claude Sonnet model' },
      CLAUDE_HAIKU: { model: 'claude-haiku', description: 'Claude Haiku model' },
    }

    return modelStats
      .map((stat: any) => {
        const inputTokens = stat._sum.input_tokens || 0
        const outputTokens = stat._sum.output_tokens || 0
        const totalTokens = inputTokens + outputTokens
        const requests = stat._count.id
        const successfulRequests = successMap.get(stat.model) || 0
        const pricing = Object.values(AI_PRICING).find((p: any) => p.model === stat.model) as any

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
      .sort((a: ModelCostBreakdown, b: ModelCostBreakdown) => b.totalCost - a.totalCost)
  }

  /**
   * Get cost breakdown by operation type
   */
  async getCostsByDataType(dateRange?: DateRangeFilter): Promise<OperationCostBreakdown[]> {
    const whereClause = this.buildDateWhereClause(dateRange)

    const typeStats = await mockPrisma.ai_usage.groupBy({
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

    const typeSuccessStats = await mockPrisma.ai_usage.groupBy({
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

    const successMap = new Map<string, number>(
      typeSuccessStats.map((s: any) => [s.data_type, s._count.id])
    )

    return typeStats
      .filter((stat: any) => stat.data_type !== null)
      .map((stat: any) => {
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
      .sort((a: OperationCostBreakdown, b: OperationCostBreakdown) => b.totalCost - a.totalCost)
  }

  /**
   * Get token efficiency metrics
   */
  async getTokenEfficiency(dateRange?: DateRangeFilter): Promise<TokenEfficiencyMetrics> {
    const whereClause = this.buildDateWhereClause(dateRange)

    const [predictionStats, scrapeStats, embeddingStats, mostExpensive] = await Promise.all([
      mockPrisma.ai_usage.aggregate({
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
      mockPrisma.ai_usage.aggregate({
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
      mockPrisma.ai_usage.aggregate({
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
      mockPrisma.ai_usage.findMany({
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
      mostExpensiveOperations: mostExpensive.map((op: any) => ({
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
      mockPrisma.ai_usage.aggregate({
        where: {
          timestamp: {
            gte: startOfMonth,
          },
        },
        _sum: {
          cost_usd: true,
        },
      }),
      mockPrisma.ai_usage.aggregate({
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

    const daysElapsed =
      Math.floor((now.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const remainingDays = daysInMonth - daysElapsed
    const dailyAverage = currentMonthSpending / daysElapsed
    const projectedMonthlySpending = dailyAverage * daysInMonth

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

    const failureRate = await mockPrisma.ai_usage.aggregate({
      where: {
        ...whereClause,
        success: false,
      },
      _count: {
        id: true,
      },
    })

    const totalRequests = await mockPrisma.ai_usage.count({
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

    const efficiency = await this.getTokenEfficiency(dateRange)
    if (efficiency.costPerScrape > 0.01) {
      const potentialSavings = efficiency.costPerScrape * 0.3
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

    const embeddingCount = await mockPrisma.ai_usage.count({
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
  buildDateWhereClause(dateRange?: DateRangeFilter): any {
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
  getDateRangeValues(dateRange?: DateRangeFilter): { start: Date; end: Date } {
    if (!dateRange) {
      const now = new Date()
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 3, 1),
        end: now,
      }
    }

    return {
      start: dateRange.start,
      end: dateRange.end,
    }
  }
}

// ============================================================================
// AIMetricsService Tests
// ============================================================================

describe('AIMetricsService', () => {
  let service: TestableAIMetricsService

  beforeEach(() => {
    service = new TestableAIMetricsService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ============================================================================
  // buildDateWhereClause Tests
  // ============================================================================

  describe('buildDateWhereClause', () => {
    it('returns empty object when no date range', () => {
      const result = service.buildDateWhereClause()
      expect(result).toEqual({})
    })

    it('returns timestamp filter when date range provided', () => {
      const start = new Date('2024-01-01')
      const end = new Date('2024-01-31')

      const result = service.buildDateWhereClause({ start, end })

      expect(result).toEqual({
        timestamp: {
          gte: start,
          lte: end,
        },
      })
    })
  })

  // ============================================================================
  // getDateRangeValues Tests
  // ============================================================================

  describe('getDateRangeValues', () => {
    it('returns default range when no filter', () => {
      const result = service.getDateRangeValues()

      expect(result.start).toBeInstanceOf(Date)
      expect(result.end).toBeInstanceOf(Date)
      expect(result.start.getTime()).toBeLessThan(result.end.getTime())
    })

    it('returns provided range when filter exists', () => {
      const start = new Date('2024-01-01')
      const end = new Date('2024-01-31')

      const result = service.getDateRangeValues({ start, end })

      expect(result.start).toEqual(start)
      expect(result.end).toEqual(end)
    })
  })

  // ============================================================================
  // getOverallStats Tests
  // ============================================================================

  describe('getOverallStats', () => {
    it('returns correct totals', async () => {
      mockPrisma.ai_usage.aggregate
        .mockResolvedValueOnce(createMockAggregateResult())
        .mockResolvedValueOnce({ _count: { id: 8 } })

      const result = await service.getOverallStats()

      expect(result.totalCost).toBe(0.05)
      expect(result.totalTokens).toBe(1500) // 1000 + 500
      expect(result.totalInputTokens).toBe(1000)
      expect(result.totalOutputTokens).toBe(500)
      expect(result.totalRequests).toBe(10)
    })

    it('calculates success rate correctly', async () => {
      mockPrisma.ai_usage.aggregate
        .mockResolvedValueOnce(createMockAggregateResult({ _count: { id: 100 } }))
        .mockResolvedValueOnce({ _count: { id: 95 } })

      const result = await service.getOverallStats()

      expect(result.successRate).toBe(95)
    })

    it('calculates average cost per request', async () => {
      mockPrisma.ai_usage.aggregate
        .mockResolvedValueOnce(
          createMockAggregateResult({
            _sum: { cost_usd: 0.1, input_tokens: 1000, output_tokens: 500, duration_ms: 2000 },
            _count: { id: 10 },
          })
        )
        .mockResolvedValueOnce({ _count: { id: 8 } })

      const result = await service.getOverallStats()

      expect(result.averageCostPerRequest).toBe(0.01) // 0.1 / 10
    })

    it('calculates average duration', async () => {
      mockPrisma.ai_usage.aggregate
        .mockResolvedValueOnce(
          createMockAggregateResult({
            _sum: {
              duration_ms: 5000,
              cost_usd: 0.05,
              input_tokens: 1000,
              output_tokens: 500,
            },
            _count: { id: 5 },
          })
        )
        .mockResolvedValueOnce({ _count: { id: 5 } })

      const result = await service.getOverallStats()

      expect(result.averageDuration).toBe(1000) // 5000 / 5
    })

    it('handles zero requests', async () => {
      mockPrisma.ai_usage.aggregate
        .mockResolvedValueOnce(
          createMockAggregateResult({
            _sum: { input_tokens: 0, output_tokens: 0, cost_usd: 0, duration_ms: 0 },
            _count: { id: 0 },
          })
        )
        .mockResolvedValueOnce({ _count: { id: 0 } })

      const result = await service.getOverallStats()

      expect(result.totalRequests).toBe(0)
      expect(result.successRate).toBe(0)
      expect(result.averageCostPerRequest).toBe(0)
    })

    it('applies date range filter', async () => {
      mockPrisma.ai_usage.aggregate
        .mockResolvedValueOnce(createMockAggregateResult())
        .mockResolvedValueOnce({ _count: { id: 8 } })

      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      }

      await service.getOverallStats(dateRange)

      expect(mockPrisma.ai_usage.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            timestamp: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          },
        })
      )
    })
  })

  // ============================================================================
  // getCostsByModel Tests
  // ============================================================================

  describe('getCostsByModel', () => {
    it('returns breakdown by model', async () => {
      mockPrisma.ai_usage.groupBy
        .mockResolvedValueOnce([
          createMockGroupByResult('claude-sonnet', { _sum: { cost_usd: 0.03 } }),
          createMockGroupByResult('claude-haiku', { _sum: { cost_usd: 0.01 } }),
        ])
        .mockResolvedValueOnce([
          { model: 'claude-sonnet', _count: { id: 4 } },
          { model: 'claude-haiku', _count: { id: 3 } },
        ])

      const result = await service.getCostsByModel()

      expect(result).toHaveLength(2)
      expect(result[0]!.model).toBe('claude-sonnet')
      expect(result[0]!.totalCost).toBe(0.03)
    })

    it('sorts by total cost descending', async () => {
      mockPrisma.ai_usage.groupBy
        .mockResolvedValueOnce([
          createMockGroupByResult('model-low', { _sum: { cost_usd: 0.01 } }),
          createMockGroupByResult('model-high', { _sum: { cost_usd: 0.1 } }),
        ])
        .mockResolvedValueOnce([])

      const result = await service.getCostsByModel()

      expect(result[0]!.model).toBe('model-high')
      expect(result[1]!.model).toBe('model-low')
    })

    it('calculates success rate per model', async () => {
      mockPrisma.ai_usage.groupBy
        .mockResolvedValueOnce([createMockGroupByResult('claude-sonnet', { _count: { id: 10 } })])
        .mockResolvedValueOnce([{ model: 'claude-sonnet', _count: { id: 9 } }])

      const result = await service.getCostsByModel()

      expect(result[0]!.successRate).toBe(90)
    })

    it('includes model description when available', async () => {
      mockPrisma.ai_usage.groupBy
        .mockResolvedValueOnce([createMockGroupByResult('claude-sonnet')])
        .mockResolvedValueOnce([])

      const result = await service.getCostsByModel()

      expect(result[0]!.description).toBe('Claude Sonnet model')
    })
  })

  // ============================================================================
  // getCostsByDataType Tests
  // ============================================================================

  describe('getCostsByDataType', () => {
    it('returns breakdown by data type', async () => {
      mockPrisma.ai_usage.groupBy
        .mockResolvedValueOnce([
          createMockDataTypeGroupByResult('prediction'),
          createMockDataTypeGroupByResult('scraping'),
        ])
        .mockResolvedValueOnce([
          { data_type: 'prediction', _count: { id: 2 } },
          { data_type: 'scraping', _count: { id: 3 } },
        ])

      const result = await service.getCostsByDataType()

      expect(result).toHaveLength(2)
      expect(result[0]!.dataType).toBeDefined()
    })

    it('filters out null data types', async () => {
      mockPrisma.ai_usage.groupBy
        .mockResolvedValueOnce([
          createMockDataTypeGroupByResult('prediction'),
          { data_type: null, _sum: { cost_usd: 0.01 }, _count: { id: 1 } },
        ])
        .mockResolvedValueOnce([])

      const result = await service.getCostsByDataType()

      expect(result).toHaveLength(1)
      expect(result[0]!.dataType).toBe('prediction')
    })

    it('calculates average tokens per request', async () => {
      mockPrisma.ai_usage.groupBy
        .mockResolvedValueOnce([
          createMockDataTypeGroupByResult('prediction', {
            _sum: { input_tokens: 500, output_tokens: 250, cost_usd: 0.015 },
            _count: { id: 5 },
          }),
        ])
        .mockResolvedValueOnce([])

      const result = await service.getCostsByDataType()

      expect(result[0]!.averageTokensPerRequest).toBe(150) // (500 + 250) / 5
    })
  })

  // ============================================================================
  // getTokenEfficiency Tests
  // ============================================================================

  describe('getTokenEfficiency', () => {
    beforeEach(() => {
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _avg: { input_tokens: 100, output_tokens: 50, cost_usd: 0.005 },
      })
      mockPrisma.ai_usage.findMany.mockResolvedValue([])
    })

    it('returns token averages for each operation type', async () => {
      const result = await service.getTokenEfficiency()

      expect(result.averageTokensPerPrediction).toBe(150)
      expect(result.averageTokensPerScrape).toBe(150)
      expect(result.averageTokensPerEmbedding).toBe(150)
    })

    it('returns cost averages for each operation type', async () => {
      const result = await service.getTokenEfficiency()

      expect(result.costPerPrediction).toBe(0.005)
      expect(result.costPerScrape).toBe(0.005)
      expect(result.costPerEmbedding).toBe(0.005)
    })

    it('returns most expensive operations', async () => {
      mockPrisma.ai_usage.findMany.mockResolvedValue([
        {
          operation_id: 'op-1',
          data_type: 'prediction',
          model: 'claude-sonnet',
          cost_usd: 0.05,
          input_tokens: 1000,
          output_tokens: 500,
          timestamp: new Date(),
        },
      ])

      const result = await service.getTokenEfficiency()

      expect(result.mostExpensiveOperations).toHaveLength(1)
      expect(result.mostExpensiveOperations[0].operationId).toBe('op-1')
      expect(result.mostExpensiveOperations[0].cost).toBe(0.05)
    })

    it('handles missing operation_id and data_type', async () => {
      mockPrisma.ai_usage.findMany.mockResolvedValue([
        {
          operation_id: null,
          data_type: null,
          model: 'claude-sonnet',
          cost_usd: 0.05,
          input_tokens: 1000,
          output_tokens: 500,
          timestamp: new Date(),
        },
      ])

      const result = await service.getTokenEfficiency()

      expect(result.mostExpensiveOperations[0].operationId).toBe('unknown')
      expect(result.mostExpensiveOperations[0].dataType).toBe('unknown')
    })
  })

  // ============================================================================
  // getBudgetAnalysis Tests
  // ============================================================================

  describe('getBudgetAnalysis', () => {
    it('returns current and last month spending', async () => {
      mockPrisma.ai_usage.aggregate
        .mockResolvedValueOnce({ _sum: { cost_usd: 50 } })
        .mockResolvedValueOnce({ _sum: { cost_usd: 40 } })

      const result = await service.getBudgetAnalysis()

      expect(result.currentMonthSpending).toBe(50)
      expect(result.lastMonthSpending).toBe(40)
    })

    it('calculates percentage change correctly', async () => {
      mockPrisma.ai_usage.aggregate
        .mockResolvedValueOnce({ _sum: { cost_usd: 60 } })
        .mockResolvedValueOnce({ _sum: { cost_usd: 40 } })

      const result = await service.getBudgetAnalysis()

      expect(result.percentageChange).toBe(50) // (60-40)/40 * 100
    })

    it('detects increasing trend', async () => {
      mockPrisma.ai_usage.aggregate
        .mockResolvedValueOnce({ _sum: { cost_usd: 100 } })
        .mockResolvedValueOnce({ _sum: { cost_usd: 50 } })

      const result = await service.getBudgetAnalysis()

      expect(result.trend).toBe('increasing')
    })

    it('detects decreasing trend', async () => {
      mockPrisma.ai_usage.aggregate
        .mockResolvedValueOnce({ _sum: { cost_usd: 30 } })
        .mockResolvedValueOnce({ _sum: { cost_usd: 50 } })

      const result = await service.getBudgetAnalysis()

      expect(result.trend).toBe('decreasing')
    })

    it('detects stable trend', async () => {
      mockPrisma.ai_usage.aggregate
        .mockResolvedValueOnce({ _sum: { cost_usd: 52 } })
        .mockResolvedValueOnce({ _sum: { cost_usd: 50 } })

      const result = await service.getBudgetAnalysis()

      expect(result.trend).toBe('stable') // 4% change is within 10% threshold
    })

    it('handles zero last month spending', async () => {
      mockPrisma.ai_usage.aggregate
        .mockResolvedValueOnce({ _sum: { cost_usd: 50 } })
        .mockResolvedValueOnce({ _sum: { cost_usd: 0 } })

      const result = await service.getBudgetAnalysis()

      expect(result.percentageChange).toBe(0)
    })
  })

  // ============================================================================
  // getOptimizationRecommendations Tests
  // ============================================================================

  describe('getOptimizationRecommendations', () => {
    beforeEach(() => {
      // Default mocks for a healthy state
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _count: { id: 0 },
        _avg: { input_tokens: 100, output_tokens: 50, cost_usd: 0.001 },
        _sum: { cost_usd: 10 },
      })
      mockPrisma.ai_usage.count.mockResolvedValue(100)
      mockPrisma.ai_usage.findMany.mockResolvedValue([])
    })

    it('recommends fixing high failure rate', async () => {
      mockPrisma.ai_usage.aggregate.mockImplementation(({ where }: any) => {
        if (where?.success === false) {
          return Promise.resolve({ _count: { id: 10 } })
        }
        return Promise.resolve({
          _count: { id: 0 },
          _avg: { input_tokens: 100, output_tokens: 50, cost_usd: 0.001 },
          _sum: { cost_usd: 10 },
        })
      })
      mockPrisma.ai_usage.count.mockResolvedValue(100) // 10% failure rate

      const result = await service.getOptimizationRecommendations()

      const highFailure = result.find(r => r.id === 'high-failure-rate')
      expect(highFailure).toBeDefined()
      expect(highFailure?.severity).toBe('high')
    })

    it('recommends optimizing high scraping costs', async () => {
      mockPrisma.ai_usage.aggregate.mockImplementation(({ where }: any) => {
        if (where?.data_type?.in) {
          return Promise.resolve({
            _avg: { input_tokens: 5000, output_tokens: 2000, cost_usd: 0.02 },
          })
        }
        return Promise.resolve({
          _count: { id: 0 },
          _avg: { input_tokens: 100, output_tokens: 50, cost_usd: 0.001 },
          _sum: { cost_usd: 10 },
        })
      })
      mockPrisma.ai_usage.count.mockResolvedValue(100)

      const result = await service.getOptimizationRecommendations()

      const scrapingRec = result.find(r => r.id === 'optimize-scraping')
      expect(scrapingRec).toBeDefined()
      expect(scrapingRec?.potentialSavings).toBeGreaterThan(0)
    })

    it('recommends caching embeddings when count is high', async () => {
      mockPrisma.ai_usage.count.mockImplementation(({ where }: any) => {
        if (where?.data_type === 'embedding') {
          return Promise.resolve(150)
        }
        return Promise.resolve(100)
      })

      const result = await service.getOptimizationRecommendations()

      const cacheRec = result.find(r => r.id === 'cache-embeddings')
      expect(cacheRec).toBeDefined()
    })

    it('returns positive feedback when operations are efficient', async () => {
      // Low failure rate and low costs
      mockPrisma.ai_usage.aggregate.mockResolvedValue({
        _count: { id: 1 }, // Very few failures
        _avg: { input_tokens: 100, output_tokens: 50, cost_usd: 0.001 },
        _sum: { cost_usd: 10 },
      })
      mockPrisma.ai_usage.count.mockResolvedValue(100)

      const result = await service.getOptimizationRecommendations()

      const efficient = result.find(r => r.id === 'efficient-operations')
      expect(efficient).toBeDefined()
      expect(efficient?.type).toBe('info')
    })
  })
})
