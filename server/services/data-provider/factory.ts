/**
 * Data Provider Factory
 *
 * Manages multiple data providers with automatic fallback.
 * Tries providers in priority order until one succeeds.
 */

import type {
  MatchDataProvider,
  MatchStatistics,
  PlayerInjury,
  TeamStatistics,
  HeadToHeadData,
  ProviderHealthReport,
} from './types'

// ============================================================================
// Factory Implementation
// ============================================================================

export class DataProviderFactory {
  private providers: MatchDataProvider[] = []

  /**
   * Register a provider
   */
  registerProvider(provider: MatchDataProvider): void {
    this.providers.push(provider)
    // Keep sorted by priority (lower = tried first)
    this.providers.sort((a, b) => a.priority - b.priority)
    console.log(
      `[DataProviderFactory] Registered provider: ${provider.name} (priority: ${provider.priority})`
    )
  }

  /**
   * Get registered providers
   */
  getProviders(): MatchDataProvider[] {
    return [...this.providers]
  }

  /**
   * Fetch statistics with automatic fallback
   */
  async getStatistics(matchId: number): Promise<MatchStatistics | null> {
    const errors: Error[] = []

    for (const provider of this.providers) {
      try {
        console.log(
          `[DataProviderFactory] Trying ${provider.name} for statistics (match ${matchId})...`
        )
        const result = await provider.getStatistics(matchId)

        if (result) {
          console.log(`[DataProviderFactory] ✅ ${provider.name} succeeded for statistics`)
          return result
        }
      } catch (error) {
        errors.push(error as Error)
        console.warn(
          `[DataProviderFactory] ❌ ${provider.name} failed: ${(error as Error).message}`
        )
        continue
      }
    }

    if (errors.length > 0) {
      console.error(
        `[DataProviderFactory] All providers failed for statistics (match ${matchId}):`,
        errors.map(e => e.message).join(', ')
      )
    }

    return null
  }

  /**
   * Fetch injuries with automatic fallback
   */
  async getInjuries(teamId: number): Promise<PlayerInjury[]> {
    const errors: Error[] = []

    for (const provider of this.providers) {
      try {
        console.log(
          `[DataProviderFactory] Trying ${provider.name} for injuries (team ${teamId})...`
        )
        const result = await provider.getInjuries(teamId)

        if (result.length > 0) {
          console.log(
            `[DataProviderFactory] ✅ ${provider.name} returned ${result.length} injuries`
          )
          return result
        }
      } catch (error) {
        errors.push(error as Error)
        console.warn(
          `[DataProviderFactory] ❌ ${provider.name} failed: ${(error as Error).message}`
        )
        continue
      }
    }

    // Empty array is acceptable (team might have no injuries)
    return []
  }

  /**
   * Fetch team stats with automatic fallback
   */
  async getTeamStats(teamId: number, season?: number): Promise<TeamStatistics | null> {
    const errors: Error[] = []

    for (const provider of this.providers) {
      try {
        console.log(
          `[DataProviderFactory] Trying ${provider.name} for team stats (team ${teamId})...`
        )
        const result = await provider.getTeamStats(teamId, season)

        if (result) {
          console.log(`[DataProviderFactory] ✅ ${provider.name} succeeded for team stats`)
          return result
        }
      } catch (error) {
        errors.push(error as Error)
        console.warn(
          `[DataProviderFactory] ❌ ${provider.name} failed: ${(error as Error).message}`
        )
        continue
      }
    }

    return null
  }

  /**
   * Fetch head-to-head with automatic fallback
   */
  async getHeadToHead(team1Id: number, team2Id: number): Promise<HeadToHeadData | null> {
    const errors: Error[] = []

    for (const provider of this.providers) {
      try {
        console.log(
          `[DataProviderFactory] Trying ${provider.name} for H2H (${team1Id} vs ${team2Id})...`
        )
        const result = await provider.getHeadToHead(team1Id, team2Id)

        if (result) {
          console.log(`[DataProviderFactory] ✅ ${provider.name} succeeded for H2H`)
          return result
        }
      } catch (error) {
        errors.push(error as Error)
        console.warn(
          `[DataProviderFactory] ❌ ${provider.name} failed: ${(error as Error).message}`
        )
        continue
      }
    }

    return null
  }

  /**
   * Get health status of all providers
   */
  async getProviderHealth(): Promise<ProviderHealthReport[]> {
    const reports: ProviderHealthReport[] = []

    for (const provider of this.providers) {
      let isHealthy = false
      try {
        isHealthy = await provider.isHealthy()
      } catch {
        isHealthy = false
      }

      reports.push({
        name: provider.name,
        source: provider.source,
        priority: provider.priority,
        healthy: isHealthy,
        circuitBreakerOpen: false, // Will be populated by specific providers
        failureCount: 0,
        lastChecked: new Date(),
      })
    }

    return reports
  }

  /**
   * Get first healthy provider
   */
  async getFirstHealthyProvider(): Promise<MatchDataProvider | null> {
    for (const provider of this.providers) {
      try {
        if (await provider.isHealthy()) {
          return provider
        }
      } catch {
        continue
      }
    }
    return null
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let factoryInstance: DataProviderFactory | null = null

export function getDataProviderFactory(): DataProviderFactory {
  if (!factoryInstance) {
    factoryInstance = new DataProviderFactory()
  }
  return factoryInstance
}

/**
 * Initialize the factory with providers based on configuration
 */
export async function initializeDataProviders(): Promise<DataProviderFactory> {
  const factory = getDataProviderFactory()

  // Only initialize once
  if (factory.getProviders().length > 0) {
    return factory
  }

  const runtimeConfig = useRuntimeConfig()
  const apiFootballConfig = runtimeConfig.apiFootball as { enabled?: boolean } | undefined
  const apiFootballEnabled = apiFootballConfig?.enabled

  // Import providers dynamically to avoid circular dependencies
  const { CachedDataProvider } = await import('./cached-provider')

  // Always register cache provider (lowest priority, last resort)
  factory.registerProvider(new CachedDataProvider())

  // Register API-Football provider if enabled
  if (apiFootballEnabled) {
    const { ApiFootballProvider } = await import('./api-football-provider')
    factory.registerProvider(new ApiFootballProvider())
    console.log('[DataProviderFactory] API-Football provider enabled')
  } else {
    console.log('[DataProviderFactory] API-Football provider disabled')
  }

  // Web scraper provider is always available as fallback
  // Note: We'll add this when we refactor the existing scraper
  // const { WebScraperProvider } = await import('./web-scraper-provider')
  // factory.registerProvider(new WebScraperProvider())

  console.log(`[DataProviderFactory] Initialized with ${factory.getProviders().length} providers`)
  return factory
}
