import { predictionService } from '~/server/services/prediction-service'
import { drawCacheService } from '~/server/services/draw-cache-service'
import { costCapService } from '~/server/services/cost-cap-service'
import { getAuthenticatedUser } from '~/server/utils/get-authenticated-user'
import { prisma } from '~/server/utils/prisma'
import type { PredictionModel } from '~/types'

interface ReEvaluateAllRequest {
  matchIds?: number[]
  contexts?: Record<number, string>
  model?: PredictionModel
}

interface ReEvaluateResult {
  matchId: number
  success: boolean
  error?: string
}

export interface ReEvaluateAllResponse {
  success: boolean
  results: ReEvaluateResult[]
  totalCost: number
  duration: number
}

export default defineEventHandler(async (event): Promise<ReEvaluateAllResponse> => {
  const startTime = Date.now()

  // Get authenticated user and check cost cap
  const user = await getAuthenticatedUser(event)
  const capCheck = await costCapService.checkUserCostCap(user.id, user.email)

  if (!capCheck.allowed) {
    throw createError({
      statusCode: 403,
      message: capCheck.reason,
      data: {
        currentSpending: capCheck.currentSpending,
        capAmount: capCheck.capAmount,
        remainingBudget: capCheck.remainingBudget,
      },
    })
  }

  const drawNumber = parseInt(event.context.params?.drawNumber || '0')
  const body = await readBody<ReEvaluateAllRequest>(event).catch((): ReEvaluateAllRequest => ({}))

  // Get all matches for the draw
  const draw = await prisma.draws.findUnique({
    where: { game_type_draw_number: { game_type: 'stryktipset', draw_number: drawNumber } },
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

  const matchIds = body?.matchIds || draw.matches.map(m => m.id)
  const contexts = body?.contexts || {}
  const model = body?.model || 'claude-sonnet-4-5'

  console.log(
    `[Re-evaluate All] Starting re-evaluation for ${matchIds.length} matches in draw ${drawNumber} using ${model}`
  )

  // Execute predictions in parallel
  const results = await Promise.all(
    matchIds.map(async (matchId: number): Promise<ReEvaluateResult> => {
      try {
        await predictionService.predictMatch(matchId, {
          userId: user.id,
          userContext: contexts[matchId],
          isReevaluation: true,
          model,
        })
        return { matchId, success: true }
      } catch (error) {
        console.error(`[Re-evaluate All] Failed for match ${matchId}:`, error)
        return {
          matchId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    })
  )

  // Calculate total cost from recent AI usage
  const recentUsage = await prisma.ai_usage.findMany({
    where: {
      operation_id: { in: matchIds.map((id: number) => `match_${id}`) },
      timestamp: { gte: new Date(startTime) },
    },
    select: { cost_usd: true },
  })

  const totalCost = recentUsage.reduce((sum, u) => sum + Number(u.cost_usd), 0)

  const duration = Date.now() - startTime
  const successCount = results.filter((r: ReEvaluateResult) => r.success).length

  console.log(
    `[Re-evaluate All] Completed: ${successCount}/${matchIds.length} successful, $${totalCost.toFixed(4)} cost, ${duration}ms`
  )

  // Invalidate draw cache so refresh() returns fresh data
  drawCacheService.invalidateDrawCache(drawNumber)

  return {
    success: results.every((r: ReEvaluateResult) => r.success),
    results,
    totalCost,
    duration,
  }
})
