import { systemGenerator } from '~/server/services/system-generator'

/**
 * GET /api/betting-systems
 * Returns list of all available R and U-systems
 */
export default defineEventHandler(async () => {
  try {
    const systems = systemGenerator.loadSystems()

    const rSystems = systems.filter(s => s.type === 'R')
    const uSystems = systems.filter(s => s.type === 'U')

    return {
      success: true,
      systems: {
        R: rSystems,
        U: uSystems,
      },
      count: {
        R: rSystems.length,
        U: uSystems.length,
        total: systems.length,
      },
    }
  } catch (error) {
    console.error('[API] Error loading betting systems:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to load betting systems',
    })
  }
})
