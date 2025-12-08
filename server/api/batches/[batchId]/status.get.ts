import { predictionService } from '~/server/services/prediction-service'
import { prisma } from '~/server/utils/prisma'

export interface BatchStatusResponse {
  batchId: string
  status: string
  drawNumber: number
  matchCount: number
  model: string
  requestCounts?: {
    processing: number
    succeeded: number
    errored: number
    canceled: number
    expired: number
  }
  resultsProcessed: boolean
  createdAt: string
  completedAt: string | null
  error: string | null
}

export default defineEventHandler(async (event): Promise<BatchStatusResponse> => {
  const batchId = event.context.params?.batchId

  if (!batchId) {
    throw createError({
      statusCode: 400,
      message: 'Batch ID is required',
    })
  }

  // Get batch from database
  const dbBatch = await prisma.prediction_batches.findUnique({
    where: { batch_id: batchId },
  })

  if (!dbBatch) {
    throw createError({
      statusCode: 404,
      message: `Batch ${batchId} not found`,
    })
  }

  // Check status with Anthropic API (and process results if complete)
  const apiStatus = await predictionService.checkBatchStatus(batchId)

  // Refresh batch from database after potential update
  const updatedBatch = await prisma.prediction_batches.findUnique({
    where: { batch_id: batchId },
  })

  return {
    batchId,
    status: apiStatus.status,
    drawNumber: dbBatch.draw_number,
    matchCount: dbBatch.match_ids.length,
    model: dbBatch.model,
    requestCounts: apiStatus.requestCounts,
    resultsProcessed: apiStatus.resultsProcessed || updatedBatch?.results !== null,
    createdAt: dbBatch.created_at.toISOString(),
    completedAt: updatedBatch?.completed_at?.toISOString() || null,
    error: updatedBatch?.error || null,
  }
})
