import { predictionService } from '~/server/services/prediction-service'
import { prisma } from '~/server/utils/prisma'
import type { PredictionModel } from '~/types'

interface BatchPredictRequest {
  model?: PredictionModel
  contexts?: Record<number, string>
}

export interface BatchPredictResponse {
  success: boolean
  batchId: string
  matchCount: number
  model: PredictionModel
  message: string
}

export default defineEventHandler(async (event): Promise<BatchPredictResponse> => {
  const drawNumber = parseInt(event.context.params?.drawNumber || '0')
  const body = await readBody<BatchPredictRequest>(event).catch((): BatchPredictRequest => ({}))

  const model = body?.model || 'claude-sonnet-4-5'
  const contexts = body?.contexts || {}

  // Get all matches for the draw
  const draw = await prisma.draws.findUnique({
    where: { draw_number: drawNumber },
    include: {
      matches: {
        select: { id: true },
      },
    },
  })

  if (!draw) {
    throw createError({
      statusCode: 404,
      message: `Draw ${drawNumber} not found`,
    })
  }

  const matchIds = draw.matches.map(m => m.id)

  if (matchIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: `Draw ${drawNumber} has no matches`,
    })
  }

  console.log(
    `[Batch Predict API] Creating batch for draw ${drawNumber} with ${matchIds.length} matches using ${model}`
  )

  // Create the batch
  const result = await predictionService.createPredictionBatch(drawNumber, matchIds, {
    model,
    contexts,
  })

  return {
    success: true,
    batchId: result.batchId,
    matchCount: result.matchCount,
    model,
    message: `Batch submitted successfully. Results will be available within 24 hours. Use GET /api/batches/${result.batchId}/status to check progress.`,
  }
})
