/**
 * Admin API endpoint for scraper metrics and cost tracking
 */

import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async _event => {
  try {
    // Get AI usage statistics
    const aiUsageStats = await prisma.ai_usage.groupBy({
      by: ['data_type', 'model'],
      _count: {
        id: true,
      },
      _sum: {
        input_tokens: true,
        output_tokens: true,
        cost_usd: true,
      },
      _avg: {
        input_tokens: true,
        output_tokens: true,
        cost_usd: true,
      },
      where: {
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    })

    // Get success rate by data type
    const successRates = await Promise.all(
      ['xStats', 'statistics', 'headToHead', 'news'].map(async dataType => {
        const total = await prisma.ai_usage.count({
          where: {
            data_type: dataType,
            timestamp: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        })

        const successful = await prisma.ai_usage.count({
          where: {
            data_type: dataType,
            success: true,
            timestamp: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        })

        return {
          dataType,
          total,
          successful,
          successRate: total > 0 ? (successful / total) * 100 : 0,
        }
      })
    )

    // Get total costs
    const totalCosts = await prisma.ai_usage.aggregate({
      _sum: {
        cost_usd: true,
      },
      where: {
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    })

    // Get daily costs for the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const dailyCosts = await prisma.$queryRaw<Array<{ date: Date; cost: number; count: number }>>`
      SELECT 
        DATE(timestamp) as date,
        SUM(cost_usd)::float as cost,
        COUNT(*)::int as count
      FROM ai_usage
      WHERE timestamp >= ${sevenDaysAgo}
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `

    // Get scraping operations statistics
    const operationsStats = await prisma.scrape_operations.groupBy({
      by: ['operation_type', 'status'],
      _count: {
        id: true,
      },
      where: {
        started_at: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    })

    // Calculate AI vs DOM comparison
    const aiVsDomComparison = await Promise.all(
      ['xStats', 'statistics', 'headToHead', 'news'].map(async dataType => {
        // AI stats
        const aiTotal = await prisma.ai_usage.count({
          where: {
            data_type: dataType,
            timestamp: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        })

        const aiSuccess = await prisma.ai_usage.count({
          where: {
            data_type: dataType,
            success: true,
            timestamp: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        })

        // DOM stats (from scrape_operations)
        const domTotal = await prisma.scrape_operations.count({
          where: {
            operation_type: dataType,
            started_at: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        })

        const domSuccess = await prisma.scrape_operations.count({
          where: {
            operation_type: dataType,
            status: 'success',
            started_at: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        })

        return {
          dataType,
          ai: {
            total: aiTotal,
            successful: aiSuccess,
            successRate: aiTotal > 0 ? (aiSuccess / aiTotal) * 100 : 0,
          },
          dom: {
            total: domTotal,
            successful: domSuccess,
            successRate: domTotal > 0 ? (domSuccess / domTotal) * 100 : 0,
          },
        }
      })
    )

    return {
      success: true,
      data: {
        aiUsageStats,
        successRates,
        totalCosts: {
          last30Days: Number(totalCosts._sum.cost_usd || 0),
          estimatedMonthly: Number(totalCosts._sum.cost_usd || 0) * (30 / 30), // Adjust based on actual days
        },
        dailyCosts,
        operationsStats,
        aiVsDomComparison,
      },
      timestamp: new Date(),
    }
  } catch (error) {
    console.error('[Scraper Metrics] Error fetching metrics:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
