import { systemGenerator } from '~/server/services/system-generator'

/**
 * GET /api/betting-systems/:systemId
 * Returns detailed information about a specific system
 */
export default defineEventHandler(async (event) => {
  try {
    const systemId = event.context.params?.systemId

    if (!systemId) {
      throw createError({
        statusCode: 400,
        message: 'System ID is required',
      })
    }

    const system = systemGenerator.getSystem(systemId)

    if (!system) {
      throw createError({
        statusCode: 404,
        message: `System ${systemId} not found`,
      })
    }

    // Calculate additional metadata
    const fullSystemRows = Math.pow(3, system.helgarderingar) * Math.pow(2, system.halvgarderingar)
    const reductionRatio = (system.rows / fullSystemRows * 100).toFixed(1)
    const estimatedCost = `${system.rows} SEK`

    return {
      success: true,
      system: {
        ...system,
        fullSystemRows,
        reductionRatio: `${reductionRatio}%`,
        estimatedCost,
      },
    }
  }
  catch (error: any) {
    if (error.statusCode) throw error

    console.error('[API] Error getting system details:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to get system details',
    })
  }
})
