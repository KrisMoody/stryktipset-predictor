import { prisma } from '../utils/prisma'
import { failedWritesQueue } from '../utils/failed-writes-queue'
import { aiUsageMetrics } from '../utils/ai-usage-metrics'

export default defineEventHandler(async _event => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'unknown', message: '' },
      aiUsageTable: { status: 'unknown', message: '' },
      aiUsageTracking: { status: 'unknown', message: '', details: {} },
    },
  }

  // Check 1: Database connection
  try {
    await prisma.$queryRaw`SELECT 1`
    health.checks.database.status = 'healthy'
    health.checks.database.message = 'Database connection successful'
  } catch (error) {
    health.status = 'unhealthy'
    health.checks.database.status = 'unhealthy'
    health.checks.database.message = error instanceof Error ? error.message : String(error)
  }

  // Check 2: AI usage table accessibility
  try {
    await prisma.$queryRaw`SELECT COUNT(*) FROM ai_usage LIMIT 1`
    health.checks.aiUsageTable.status = 'healthy'
    health.checks.aiUsageTable.message = 'ai_usage table is accessible'
  } catch (error) {
    health.status = 'unhealthy'
    health.checks.aiUsageTable.status = 'unhealthy'
    health.checks.aiUsageTable.message = error instanceof Error ? error.message : String(error)
  }

  // Check 3: AI usage tracking metrics
  try {
    const metrics = aiUsageMetrics.getMetrics()
    const queueStatus = failedWritesQueue.getStatus()

    const successRate = parseFloat(metrics.successRate.replace('%', ''))
    const _hasFailures = metrics.failedWrites > 0
    const queueSize = queueStatus.queueSize

    if (successRate === 100 && queueSize === 0) {
      health.checks.aiUsageTracking.status = 'healthy'
      health.checks.aiUsageTracking.message = 'All AI usage writes successful'
    } else if (successRate >= 95 && queueSize < 10) {
      health.checks.aiUsageTracking.status = 'degraded'
      health.checks.aiUsageTracking.message = 'Some AI usage writes failing'
    } else {
      health.status = 'degraded'
      health.checks.aiUsageTracking.status = 'unhealthy'
      health.checks.aiUsageTracking.message = 'Many AI usage writes failing'
    }

    health.checks.aiUsageTracking.details = {
      successRate: metrics.successRate,
      totalAttempts: metrics.totalAttempts,
      failedWrites: metrics.failedWrites,
      queueSize: queueStatus.queueSize,
      recentErrorsCount: metrics.recentErrors.length,
    }
  } catch (error) {
    health.checks.aiUsageTracking.status = 'unknown'
    health.checks.aiUsageTracking.message = error instanceof Error ? error.message : String(error)
  }

  return health
})
