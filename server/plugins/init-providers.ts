import { initializeDataProviders } from '../services/data-provider'

/**
 * Nitro plugin to initialize data providers at application startup.
 *
 * This registers the DataProviderFactory with appropriate providers
 * based on configuration (API-Football, cache, etc.).
 */
export default defineNitroPlugin(async () => {
  // Skip in CI/test environments
  if (process.env.CI || process.env.NODE_ENV === 'test') {
    console.log('[DataProviders] Skipping initialization in CI/test environment')
    return
  }

  console.log('[DataProviders] Initializing data providers...')

  try {
    const factory = await initializeDataProviders()
    const providers = factory.getProviders()

    console.log('[DataProviders] Initialization complete:')
    for (const provider of providers) {
      console.log(
        `  - ${provider.name} (priority: ${provider.priority}, source: ${provider.source})`
      )
    }
  } catch (error) {
    // Log error but don't crash - the app can still work with scraping only
    console.error('[DataProviders] Failed to initialize data providers:', error)
    console.warn('[DataProviders] Predictions will fall back to web scraping only')
  }
})
