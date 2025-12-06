import { systemPerformanceAnalyzer } from '~/server/services/system-performance-analyzer'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { systemIds } = body

  if (!systemIds || !Array.isArray(systemIds) || systemIds.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Array of system IDs is required',
    })
  }

  try {
    const comparison = await systemPerformanceAnalyzer.compareSystems(systemIds)

    return {
      success: true,
      comparison,
    }
  }
  catch (error: any) {
    console.error('Failed to compare systems:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to compare systems',
      data: { error: error.message },
    })
  }
})
