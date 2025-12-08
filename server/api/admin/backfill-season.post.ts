import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/require-admin'
import {
  seasonBackfillService,
  type SeasonBackfillOptions,
} from '~/server/services/season-backfill'

/**
 * Request body for backfill season endpoint
 */
interface BackfillSeasonRequest {
  startDate: string
  endDate: string
  options?: {
    batchSize?: number
    skipExisting?: boolean
    archiveOnComplete?: boolean
    retryAttempts?: number
  }
}

/**
 * API endpoint to trigger season backfill operation
 * POST /api/admin/backfill-season
 */
export default defineEventHandler(async event => {
  await requireAdmin(event)

  try {
    // Parse and validate request body
    const body = await readBody<BackfillSeasonRequest>(event)

    if (!body.startDate || !body.endDate) {
      throw createError({
        statusCode: 400,
        message: 'Missing required fields: startDate and endDate',
      })
    }

    const startDate = new Date(body.startDate)
    const endDate = new Date(body.endDate)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw createError({
        statusCode: 400,
        message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)',
      })
    }

    if (startDate > endDate) {
      throw createError({
        statusCode: 400,
        message: 'startDate must be before or equal to endDate',
      })
    }

    console.log('[Backfill API] Received backfill request')
    console.log(`[Backfill API] Date range: ${body.startDate} to ${body.endDate}`)

    // Create operation record in database
    const operation = await prisma.backfill_operations.create({
      data: {
        operation_type: 'season',
        start_date: startDate,
        end_date: endDate,
        status: 'running',
        total_draws: 0,
        config: body.options || {},
      },
    })

    console.log(`[Backfill API] Created operation ${operation.id}`)

    // Build options for backfill service
    const backfillOptions: SeasonBackfillOptions = {
      startDate,
      endDate,
      batchSize: body.options?.batchSize,
      skipExisting: body.options?.skipExisting,
      archiveOnComplete: body.options?.archiveOnComplete,
      retryAttempts: body.options?.retryAttempts,
      progressCallback: async progress => {
        // Update operation record with progress
        try {
          await prisma.backfill_operations.update({
            where: { id: operation.id },
            data: {
              total_draws: progress.totalDraws,
              processed_draws: progress.processedDraws,
              successful_draws: progress.successfulDraws,
              failed_draws: progress.failedDraws,
              skipped_draws: progress.skippedDraws,
              error_log:
                progress.errors.length > 0
                  ? JSON.parse(JSON.stringify(progress.errors))
                  : undefined,
            },
          })
        } catch (error) {
          console.warn(
            `[Backfill API] Failed to update progress for operation ${operation.id}:`,
            error
          )
        }
      },
    }

    // Run backfill asynchronously (don't block response)
    seasonBackfillService
      .backfillSeason(backfillOptions)
      .then(async result => {
        console.log(`[Backfill API] Operation ${operation.id} completed successfully`)
        await prisma.backfill_operations.update({
          where: { id: operation.id },
          data: {
            status: 'completed',
            total_draws: result.totalDraws,
            processed_draws: result.processedDraws,
            successful_draws: result.successfulDraws,
            failed_draws: result.failedDraws,
            skipped_draws: result.skippedDraws,
            error_log:
              result.errors.length > 0 ? JSON.parse(JSON.stringify(result.errors)) : undefined,
            completed_at: new Date(),
          },
        })
      })
      .catch(async error => {
        console.error(`[Backfill API] Operation ${operation.id} failed:`, error)
        await prisma.backfill_operations.update({
          where: { id: operation.id },
          data: {
            status: 'failed',
            error_log: [
              {
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            ],
            completed_at: new Date(),
          },
        })
      })

    // Return operation ID immediately
    return {
      success: true,
      operationId: operation.id,
      message: 'Backfill operation started',
      trackingUrl: `/api/admin/backfill-status/${operation.id}`,
    }
  } catch (error) {
    console.error('[Backfill API] Error starting backfill:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error // Re-throw validation errors
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to start backfill operation',
    })
  }
})
