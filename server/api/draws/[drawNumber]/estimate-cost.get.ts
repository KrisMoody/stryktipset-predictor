import { prisma } from '~/server/utils/prisma'
import { AI_PRICING, getModelPricing } from '~/server/constants/ai-pricing'
import type { CostEstimation, PredictionModel } from '~/types'

// Default average tokens based on typical predictions
const DEFAULT_AVG_INPUT_TOKENS = 2500
const DEFAULT_AVG_OUTPUT_TOKENS = 800

export default defineEventHandler(async (event): Promise<CostEstimation> => {
  const drawNumber = parseInt(event.context.params?.drawNumber || '0')
  const query = getQuery(event)
  const model = (query.model as PredictionModel) || 'claude-sonnet-4-5'

  // Get match count for the draw
  const draw = await prisma.draws.findUnique({
    where: { draw_number: drawNumber },
    include: { matches: { select: { id: true } } },
  })

  if (!draw) {
    throw createError({
      statusCode: 404,
      message: `Draw ${drawNumber} not found`,
    })
  }

  const matchCount = draw.matches.length || 13

  // Calculate from recent AI usage for more accurate estimates
  const recentPredictions = await prisma.ai_usage.findMany({
    where: {
      data_type: 'prediction',
      success: true,
      timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { input_tokens: true, output_tokens: true },
    take: 100,
  })

  let avgInputTokens = DEFAULT_AVG_INPUT_TOKENS
  let avgOutputTokens = DEFAULT_AVG_OUTPUT_TOKENS

  if (recentPredictions.length > 0) {
    avgInputTokens = Math.round(
      recentPredictions.reduce((sum, p) => sum + p.input_tokens, 0) / recentPredictions.length
    )
    avgOutputTokens = Math.round(
      recentPredictions.reduce((sum, p) => sum + p.output_tokens, 0) / recentPredictions.length
    )
  }

  const totalInputTokens = avgInputTokens * matchCount
  const totalOutputTokens = avgOutputTokens * matchCount

  // Get pricing for the selected model
  const pricing = getModelPricing(model) || AI_PRICING.CLAUDE_SONNET_4_5
  const estimatedCost =
    (totalInputTokens / 1_000_000) * pricing.inputPricePerMillion +
    (totalOutputTokens / 1_000_000) * pricing.outputPricePerMillion

  return {
    estimatedInputTokens: totalInputTokens,
    estimatedOutputTokens: totalOutputTokens,
    estimatedCost: Math.round(estimatedCost * 1000000) / 1000000, // 6 decimal places
    matchCount,
    currency: 'USD',
    model,
  }
})
