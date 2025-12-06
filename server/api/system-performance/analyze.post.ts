import { systemPerformanceAnalyzer } from '~/server/services/system-performance-analyzer'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { drawNumber } = body

  if (!drawNumber) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Draw number is required',
    })
  }

  try {
    const analyzedCount = await systemPerformanceAnalyzer.analyzeCompletedDraw(drawNumber)

    return {
      success: true,
      analyzedCount,
      message: `Analyzed ${analyzedCount} system performances for draw ${drawNumber}`,
    }
  }
  catch (error: any) {
    console.error(`Failed to analyze draw ${drawNumber}:`, error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to analyze draw',
      data: { error: error.message },
    })
  }
})
