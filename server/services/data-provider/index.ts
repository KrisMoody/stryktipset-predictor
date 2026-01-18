/**
 * Data Provider Module
 *
 * Provides a unified interface for fetching match data from multiple sources
 * (API-Football, web scraping, cache) with automatic fallback.
 */

// Types
export * from './types'

// Factory
export { DataProviderFactory, getDataProviderFactory, initializeDataProviders } from './factory'

// Providers
export { CachedDataProvider } from './cached-provider'
export { ApiFootballProvider } from './api-football-provider'
