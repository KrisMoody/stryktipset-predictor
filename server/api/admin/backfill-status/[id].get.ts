import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/require-admin'

/**
 * API endpoint to check backfill operation status
 * GET /api/admin/backfill-status/:id
 */
export default defineEventHandler(async event => {
  await requireAdmin(event)

  try {
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'Missing operation ID',
      })
    }

    const operationId = parseInt(id, 10)

    if (isNaN(operationId)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid operation ID. Must be a number',
      })
    }

    // Fetch operation from database
    const operation = await prisma.backfill_operations.findUnique({
      where: { id: operationId },
    })

    if (!operation) {
      throw createError({
        statusCode: 404,
        message: `Operation ${operationId} not found`,
      })
    }

    // Calculate progress percentage
    const progressPercentage =
      operation.total_draws > 0
        ? Math.round((operation.processed_draws / operation.total_draws) * 100)
        : 0

    // Calculate estimated time remaining (if still running)
    let estimatedTimeRemaining: number | null = null
    if (operation.status === 'running' && operation.processed_draws > 0) {
      const elapsed = Date.now() - operation.started_at.getTime()
      const avgTimePerDraw = elapsed / operation.processed_draws
      const remainingDraws = operation.total_draws - operation.processed_draws
      estimatedTimeRemaining = Math.round(avgTimePerDraw * remainingDraws)
    }

    // Calculate duration
    const duration = operation.completed_at
      ? operation.completed_at.getTime() - operation.started_at.getTime()
      : Date.now() - operation.started_at.getTime()

    return {
      operation: {
        id: operation.id,
        operationType: operation.operation_type,
        startDate: operation.start_date,
        endDate: operation.end_date,
        status: operation.status,
        totalDraws: operation.total_draws,
        processedDraws: operation.processed_draws,
        successfulDraws: operation.successful_draws,
        failedDraws: operation.failed_draws,
        skippedDraws: operation.skipped_draws,
        errors: operation.error_log || [],
        config: operation.config || {},
        startedAt: operation.started_at,
        completedAt: operation.completed_at,
        cancelledAt: operation.cancelled_at,
      },
      progress: {
        percentage: progressPercentage,
        estimatedTimeRemaining,
        duration,
      },
    }
  } catch (error) {
    console.error('[Backfill Status API] Error fetching status:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error // Re-throw validation errors
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to fetch operation status',
    })
  }
})
