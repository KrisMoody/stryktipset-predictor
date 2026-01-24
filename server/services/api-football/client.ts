/**
 * API-Football Client Service
 *
 * HTTP client for API-Football with rate limiting, caching, retry logic,
 * and circuit breaker pattern for automatic fallback.
 *
 * @see https://www.api-football.com/documentation-v3
 */

import { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'

// ============================================================================
// Types
// ============================================================================

export interface ApiFootballConfig {
  apiKey: string
  baseUrl: string
  maxRequestsPerMinute: number
  circuitBreakerThreshold: number
  circuitBreakerTimeoutMs: number
  dailyRequestLimit: number // Daily API call quota for direct API (Pro tier: 7,500/day)
  // RapidAPI alternative configuration (free tier has strict limits)
  rapidApiKey: string
  rapidApiBaseUrl: string
  rapidApiHost: string
  rapidApiMaxRequestsPerMinute: number
  rapidApiCircuitBreakerThreshold: number
  rapidApiCircuitBreakerTimeoutMs: number
  rapidApiDailyRequestLimit: number // RapidAPI free tier: 100 requests/day
}

type ApiProvider = 'direct' | 'rapidapi'

export interface ApiFootballResponse<T> {
  get: string
  parameters: Record<string, string>
  errors: Record<string, string> | string[]
  results: number
  paging: {
    current: number
    total: number
  }
  response: T
}

interface CacheEntry<T> {
  data: T
  expiresAt: Date
}

interface ApiFootballStatusResponse {
  account: {
    firstname: string
    lastname: string
    email: string
    requests: {
      current: number
      limit_day: number
    }
  }
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

// ============================================================================
// Circuit Breaker
// ============================================================================

class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private lastFailureTime: Date | null = null
  private readonly threshold: number
  private readonly timeoutMs: number

  constructor(threshold: number, timeoutMs: number) {
    this.threshold = threshold
    this.timeoutMs = timeoutMs
  }

  isOpen(): boolean {
    if (this.state === 'CLOSED') {
      return false
    }

    // Check if timeout has passed
    if (this.lastFailureTime) {
      const elapsed = Date.now() - this.lastFailureTime.getTime()
      if (elapsed > this.timeoutMs) {
        console.log('[CircuitBreaker] Timeout elapsed, entering half-open state')
        this.state = 'HALF_OPEN'
        return false
      }
    }

    return true
  }

  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      console.log('[CircuitBreaker] Success in half-open state, closing circuit')
    }
    this.failureCount = 0
    this.lastFailureTime = null
    this.state = 'CLOSED'
  }

  recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = new Date()

    if (this.failureCount >= this.threshold) {
      console.error(
        `[CircuitBreaker] Threshold reached (${this.failureCount} failures), opening circuit`
      )
      this.state = 'OPEN'
    }
  }

  getState(): CircuitState {
    return this.state
  }

  getFailureCount(): number {
    return this.failureCount
  }
}

// ============================================================================
// Rate Limiter
// ============================================================================

type QuotaStatusGetter = () => { used: number; limit: number; remaining: number }

class RateLimiter {
  private requestTimes: number[] = []
  private readonly maxRequests: number
  private readonly windowMs: number
  private quotaStatusGetter?: QuotaStatusGetter

  constructor(maxRequestsPerMinute: number) {
    this.maxRequests = maxRequestsPerMinute
    this.windowMs = 60 * 1000 // 1 minute
  }

  /**
   * Set the quota status getter for enhanced logging
   */
  setQuotaStatusGetter(getter: QuotaStatusGetter): void {
    this.quotaStatusGetter = getter
  }

  async waitForSlot(): Promise<void> {
    // Clean up old request times
    const now = Date.now()
    this.requestTimes = this.requestTimes.filter(t => now - t < this.windowMs)

    if (this.requestTimes.length >= this.maxRequests) {
      // Calculate wait time until oldest request expires
      const oldestRequest = this.requestTimes[0]
      if (oldestRequest !== undefined) {
        const waitTime = this.windowMs - (now - oldestRequest) + 100 // Add 100ms buffer

        // Log with quota context for long waits (>10s)
        if (waitTime > 10000 && this.quotaStatusGetter) {
          const quota = this.quotaStatusGetter()
          const quotaPercent = ((quota.used / quota.limit) * 100).toFixed(1)
          console.warn(
            `[RateLimiter] Long wait detected: ${waitTime}ms | Daily quota: ${quota.used}/${quota.limit} (${quotaPercent}%) | Remaining: ${quota.remaining}`
          )
        } else {
          console.log(`[RateLimiter] Rate limit reached, waiting ${waitTime}ms`)
        }
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }

      // Recursive call to check again
      return this.waitForSlot()
    }

    // Add minimum delay between requests (500ms)
    if (this.requestTimes.length > 0) {
      const lastRequest = this.requestTimes[this.requestTimes.length - 1]
      if (lastRequest !== undefined) {
        const timeSinceLastRequest = now - lastRequest
        if (timeSinceLastRequest < 500) {
          await new Promise(resolve => setTimeout(resolve, 500 - timeSinceLastRequest))
        }
      }
    }

    this.requestTimes.push(Date.now())
  }
}

// ============================================================================
// Daily Quota Tracker
// ============================================================================

class DailyQuotaTracker {
  private requestCount: number = 0
  private currentDay: string = ''
  private readonly dailyLimit: number
  private initialized: boolean = false

  constructor(dailyLimit: number) {
    this.dailyLimit = dailyLimit
  }

  /**
   * Initialize from database on first use
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return

    const today = this.getTodayString()
    this.currentDay = today

    // Count today's non-cached API calls from the database
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    try {
      const count = await prisma.api_football_usage.count({
        where: {
          created_at: { gte: todayStart },
          cached: false,
        },
      })
      this.requestCount = count
      console.log(`[DailyQuota] Initialized: ${count}/${this.dailyLimit} requests used today`)
    } catch (error) {
      console.warn('[DailyQuota] Failed to initialize from database, starting fresh:', error)
      this.requestCount = 0
    }

    this.initialized = true
  }

  private getTodayString(): string {
    return new Date().toISOString().split('T')[0]!
  }

  /**
   * Check if there's quota remaining for today
   */
  async hasQuotaRemaining(): Promise<boolean> {
    await this.initialize()

    // Reset counter if day changed
    const today = this.getTodayString()
    if (today !== this.currentDay) {
      console.log(`[DailyQuota] New day detected, resetting counter`)
      this.currentDay = today
      this.requestCount = 0
    }

    return this.requestCount < this.dailyLimit
  }

  /**
   * Record an API call (non-cached)
   */
  recordRequest(): void {
    this.requestCount++

    const percentUsed = (this.requestCount / this.dailyLimit) * 100

    if (this.requestCount === this.dailyLimit) {
      console.warn(`[DailyQuota] Daily limit of ${this.dailyLimit} requests reached!`)
    } else if (percentUsed >= 90 && percentUsed < 100) {
      // Warn when approaching limit (90%+)
      const remaining = this.dailyLimit - this.requestCount
      console.warn(
        `[DailyQuota] Approaching daily limit: ${this.requestCount}/${this.dailyLimit} (${percentUsed.toFixed(1)}%) | Remaining: ${remaining}`
      )
    } else if (this.requestCount % 10 === 0 || this.requestCount >= this.dailyLimit - 10) {
      console.log(`[DailyQuota] ${this.requestCount}/${this.dailyLimit} requests used today`)
    }
  }

  /**
   * Get current quota status
   */
  getStatus(): { used: number; limit: number; remaining: number } {
    return {
      used: this.requestCount,
      limit: this.dailyLimit,
      remaining: Math.max(0, this.dailyLimit - this.requestCount),
    }
  }
}

// ============================================================================
// API-Football Client
// ============================================================================

export class ApiFootballClient {
  private readonly config: ApiFootballConfig
  private readonly circuitBreaker: CircuitBreaker
  private readonly rateLimiter: RateLimiter
  private readonly dailyQuotaTracker: DailyQuotaTracker
  private readonly memoryCache: Map<string, CacheEntry<unknown>> = new Map()
  private readonly provider: ApiProvider

  constructor(config?: Partial<ApiFootballConfig>) {
    const runtimeConfig = useRuntimeConfig()
    const apiFootballConfig = (runtimeConfig.apiFootball || {}) as Record<string, unknown>

    this.config = {
      apiKey: config?.apiKey || (apiFootballConfig.apiKey as string) || '',
      baseUrl:
        config?.baseUrl ||
        (apiFootballConfig.baseUrl as string) ||
        'https://v3.football.api-sports.io',
      maxRequestsPerMinute:
        config?.maxRequestsPerMinute || (apiFootballConfig.maxRequestsPerMinute as number) || 2,
      circuitBreakerThreshold:
        config?.circuitBreakerThreshold ||
        (apiFootballConfig.circuitBreakerThreshold as number) ||
        10, // Allow more transient failures before opening (was 3)
      circuitBreakerTimeoutMs:
        config?.circuitBreakerTimeoutMs ||
        (apiFootballConfig.circuitBreakerTimeoutMs as number) ||
        60 * 1000, // 1 minute recovery time (was 5 minutes)
      // RapidAPI configuration
      rapidApiKey: config?.rapidApiKey || (apiFootballConfig.rapidApiKey as string) || '',
      rapidApiBaseUrl:
        config?.rapidApiBaseUrl ||
        (apiFootballConfig.rapidApiBaseUrl as string) ||
        'https://api-football-v1.p.rapidapi.com/v3',
      rapidApiHost:
        config?.rapidApiHost ||
        (apiFootballConfig.rapidApiHost as string) ||
        'api-football-v1.p.rapidapi.com',
      rapidApiMaxRequestsPerMinute:
        config?.rapidApiMaxRequestsPerMinute ||
        (apiFootballConfig.rapidApiMaxRequestsPerMinute as number) ||
        2,
      rapidApiCircuitBreakerThreshold:
        config?.rapidApiCircuitBreakerThreshold ||
        (apiFootballConfig.rapidApiCircuitBreakerThreshold as number) ||
        10, // Allow more transient failures before opening (was 3)
      rapidApiCircuitBreakerTimeoutMs:
        config?.rapidApiCircuitBreakerTimeoutMs ||
        (apiFootballConfig.rapidApiCircuitBreakerTimeoutMs as number) ||
        60 * 1000, // 1 minute recovery time (was 5 minutes)
      rapidApiDailyRequestLimit:
        config?.rapidApiDailyRequestLimit ||
        (apiFootballConfig.rapidApiDailyRequestLimit as number) ||
        100, // RapidAPI free tier: 100 requests/day
      dailyRequestLimit:
        config?.dailyRequestLimit || (apiFootballConfig.dailyRequestLimit as number) || 7500, // Direct API Pro tier: 7,500 requests/day
    }

    // Determine which provider to use: prefer direct API if configured, otherwise RapidAPI
    this.provider = this.config.apiKey ? 'direct' : this.config.rapidApiKey ? 'rapidapi' : 'direct'

    if (this.provider === 'rapidapi') {
      console.log('[ApiFootball] Using RapidAPI provider (free tier: 100 req/day limit)')
    } else if (this.config.apiKey) {
      console.log('[ApiFootball] Using direct API provider (Pro tier: 7,500 req/day limit)')
    }

    // Use provider-specific settings for circuit breaker and rate limiter
    const cbThreshold =
      this.provider === 'rapidapi'
        ? this.config.rapidApiCircuitBreakerThreshold
        : this.config.circuitBreakerThreshold
    const cbTimeout =
      this.provider === 'rapidapi'
        ? this.config.rapidApiCircuitBreakerTimeoutMs
        : this.config.circuitBreakerTimeoutMs
    const maxRequests =
      this.provider === 'rapidapi'
        ? this.config.rapidApiMaxRequestsPerMinute
        : this.config.maxRequestsPerMinute
    const dailyLimit =
      this.provider === 'rapidapi'
        ? this.config.rapidApiDailyRequestLimit
        : this.config.dailyRequestLimit

    this.circuitBreaker = new CircuitBreaker(cbThreshold, cbTimeout)
    this.rateLimiter = new RateLimiter(maxRequests)
    this.dailyQuotaTracker = new DailyQuotaTracker(dailyLimit)

    // Wire up quota status getter for enhanced rate limiter logging
    this.rateLimiter.setQuotaStatusGetter(() => this.dailyQuotaTracker.getStatus())
  }

  /**
   * Check if the client is configured with an API key (direct or RapidAPI)
   */
  isConfigured(): boolean {
    return !!this.config.apiKey || !!this.config.rapidApiKey
  }

  /**
   * Get the active provider type
   */
  getProvider(): ApiProvider {
    return this.provider
  }

  /**
   * Get the effective base URL based on the active provider
   */
  private getEffectiveBaseUrl(): string {
    return this.provider === 'rapidapi' ? this.config.rapidApiBaseUrl : this.config.baseUrl
  }

  /**
   * Get the authentication headers based on the active provider
   */
  private getAuthHeaders(): Record<string, string> {
    if (this.provider === 'rapidapi') {
      return {
        'X-RapidAPI-Key': this.config.rapidApiKey,
        'X-RapidAPI-Host': this.config.rapidApiHost,
      }
    }
    return {
      'x-apisports-key': this.config.apiKey,
    }
  }

  /**
   * Check if the circuit breaker is open (API should be skipped)
   */
  isCircuitOpen(): boolean {
    return this.circuitBreaker.isOpen()
  }

  /**
   * Get the current circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState()
  }

  /**
   * Make a GET request to API-Football
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, string | number>,
    options?: {
      cacheTtlSeconds?: number
      skipCache?: boolean
      skipRateLimit?: boolean
      skipCircuitBreaker?: boolean
    }
  ): Promise<ApiFootballResponse<T>> {
    const cacheKey = this.buildCacheKey(endpoint, params)

    // Check memory cache first
    if (!options?.skipCache) {
      const cached = this.getFromMemoryCache<ApiFootballResponse<T>>(cacheKey)
      if (cached) {
        // Don't return cached empty responses - they should be refetched
        const hasData = Array.isArray(cached.response)
          ? cached.response.length > 0
          : !!cached.response
        if (hasData) {
          console.log(`[ApiFootball] Cache hit (memory): ${endpoint}`)
          await this.trackUsage(endpoint, params, 200, 0, true)
          return cached
        } else {
          console.log(`[ApiFootball] Skipping empty cached response for ${endpoint}`)
          this.memoryCache.delete(cacheKey) // Clean up empty cache entry
        }
      }

      // Check database cache
      const dbCached = await this.getFromDbCache<ApiFootballResponse<T>>(endpoint, params)
      if (dbCached) {
        // Don't return cached empty responses - they should be refetched
        const hasData = Array.isArray(dbCached.response)
          ? dbCached.response.length > 0
          : !!dbCached.response
        if (hasData) {
          console.log(`[ApiFootball] Cache hit (db): ${endpoint}`)
          await this.trackUsage(endpoint, params, 200, 0, true)
          // Also store in memory cache for faster access
          if (options?.cacheTtlSeconds) {
            this.setMemoryCache(cacheKey, dbCached, options.cacheTtlSeconds)
          }
          return dbCached
        } else {
          console.log(`[ApiFootball] Skipping empty db cache for ${endpoint}, will refetch`)
          // Delete the empty cache entry from database
          await prisma.api_football_cache.deleteMany({
            where: { endpoint, params: params ?? {} },
          })
        }
      }
    }

    // Check circuit breaker (can be bypassed for critical requests like /leagues)
    if (!options?.skipCircuitBreaker && this.circuitBreaker.isOpen()) {
      throw new Error('Circuit breaker is open - API-Football is temporarily unavailable')
    }

    // Check daily quota before making request
    if (!(await this.dailyQuotaTracker.hasQuotaRemaining())) {
      const status = this.dailyQuotaTracker.getStatus()
      throw new Error(
        `Daily API quota exhausted (${status.used}/${status.limit}). ` +
          `Quota resets at midnight UTC. Cached data will still be served.`
      )
    }

    // Wait for rate limit slot
    if (!options?.skipRateLimit) {
      await this.rateLimiter.waitForSlot()
    }

    const startTime = Date.now()
    let statusCode = 0
    let errorMessage: string | undefined

    try {
      // Build the URL properly - need to handle path joining correctly
      // new URL('/endpoint', 'https://host/v3') would incorrectly give 'https://host/endpoint'
      // We need 'https://host/v3/endpoint' instead
      const baseUrl = this.getEffectiveBaseUrl()
      const fullPath = baseUrl.endsWith('/') ? baseUrl + endpoint.slice(1) : baseUrl + endpoint
      const url = new URL(fullPath)
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, String(value))
        })
      }

      console.log(`[ApiFootball] Fetching (${this.provider}): ${endpoint}`, params)

      const response = await this.fetchWithRetry<ApiFootballResponse<T>>(url.toString())
      statusCode = 200

      // Record this API call against daily quota
      this.dailyQuotaTracker.recordRequest()

      // Check for API errors in response
      if (response.errors && Object.keys(response.errors).length > 0) {
        const errorStr = JSON.stringify(response.errors)
        console.error(`[ApiFootball] API returned errors: ${errorStr}`)
        errorMessage = errorStr
        // Still record as success for circuit breaker (API responded)
      }

      this.circuitBreaker.recordSuccess()

      // Cache the response - but don't cache empty responses for endpoints that should return data
      const hasData = Array.isArray(response.response)
        ? response.response.length > 0
        : !!response.response
      if (options?.cacheTtlSeconds && !errorMessage && hasData) {
        this.setMemoryCache(cacheKey, response, options.cacheTtlSeconds)
        await this.setDbCache(endpoint, params, response, options.cacheTtlSeconds)
      } else if (!hasData) {
        console.warn(`[ApiFootball] Not caching empty response for ${endpoint}`)
      }

      return response
    } catch (error) {
      this.circuitBreaker.recordFailure()
      statusCode =
        error instanceof Error && 'statusCode' in error
          ? (error as { statusCode: number }).statusCode
          : 500
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw error
    } finally {
      const responseTimeMs = Date.now() - startTime
      await this.trackUsage(endpoint, params, statusCode, responseTimeMs, false, errorMessage)
    }
  }

  /**
   * Fetch with exponential backoff retry
   */
  private async fetchWithRetry<T>(url: string, retries = 3): Promise<T> {
    const delays = [1000, 2000, 4000] // 1s, 2s, 4s
    const rateLimitDelays = [30000, 60000, 120000] // 30s, 60s, 120s for 429

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await $fetch(url, {
          method: 'GET',
          headers: {
            ...this.getAuthHeaders(),
            Accept: 'application/json',
          },
          timeout: 30000,
        })

        return response as T
      } catch (error: unknown) {
        const isLastAttempt = attempt === retries
        const err = error as { statusCode?: number; status?: number; message?: string }
        const statusCode = err?.statusCode ?? err?.status ?? 0

        // Handle rate limiting (429)
        if (statusCode === 429 && !isLastAttempt) {
          const delay = rateLimitDelays[attempt] || 120000
          console.warn(`[ApiFootball] Rate limited (429), waiting ${delay}ms before retry`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        // Handle server errors (5xx)
        if (statusCode >= 500 && !isLastAttempt) {
          const delay = delays[attempt] || 4000
          console.warn(`[ApiFootball] Server error (${statusCode}), retrying in ${delay}ms`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        // Don't retry client errors (4xx except 429)
        if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
          throw error
        }

        if (isLastAttempt) {
          throw error
        }

        // Generic retry for other errors
        const delay = delays[attempt] || 4000
        console.warn(`[ApiFootball] Request failed, retrying in ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw new Error('Max retries exceeded')
  }

  // ==========================================================================
  // Caching
  // ==========================================================================

  private buildCacheKey(endpoint: string, params?: Record<string, string | number>): string {
    const sortedParams = params
      ? Object.entries(params)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join('&')
      : ''
    return `${endpoint}?${sortedParams}`
  }

  private getFromMemoryCache<T>(key: string): T | null {
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    if (new Date() > entry.expiresAt) {
      this.memoryCache.delete(key)
      return null
    }

    return entry.data
  }

  private setMemoryCache<T>(key: string, data: T, ttlSeconds: number): void {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
    this.memoryCache.set(key, { data, expiresAt })
  }

  private async getFromDbCache<T>(
    endpoint: string,
    params?: Record<string, string | number>
  ): Promise<T | null> {
    try {
      const paramsJson: Prisma.InputJsonValue = params ?? {}
      const cached = await prisma.api_football_cache.findFirst({
        where: {
          endpoint,
          params: { equals: paramsJson },
          expires_at: { gt: new Date() },
        },
      })

      if (cached) {
        return cached.response as T
      }
    } catch (error) {
      console.warn('[ApiFootball] Database cache lookup failed:', error)
    }

    return null
  }

  private async setDbCache<T>(
    endpoint: string,
    params: Record<string, string | number> | undefined,
    data: T,
    ttlSeconds: number
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
      const paramsJson: Prisma.InputJsonValue = params ?? {}
      const responseJson = data as Prisma.InputJsonValue

      await prisma.api_football_cache.upsert({
        where: {
          endpoint_params: {
            endpoint,
            params: paramsJson,
          },
        },
        update: {
          response: responseJson,
          expires_at: expiresAt,
        },
        create: {
          endpoint,
          params: paramsJson,
          response: responseJson,
          expires_at: expiresAt,
        },
      })
    } catch (error) {
      console.warn('[ApiFootball] Database cache write failed:', error)
    }
  }

  // ==========================================================================
  // Usage Tracking
  // ==========================================================================

  private async trackUsage(
    endpoint: string,
    params: Record<string, string | number> | undefined,
    statusCode: number,
    responseTimeMs: number,
    cached: boolean,
    errorMessage?: string
  ): Promise<void> {
    try {
      await prisma.api_football_usage.create({
        data: {
          endpoint,
          params: params ?? Prisma.JsonNull,
          status_code: statusCode,
          response_time_ms: responseTimeMs,
          cached,
          error_message: errorMessage,
        },
      })
    } catch (error) {
      console.warn('[ApiFootball] Usage tracking failed:', error)
    }
  }

  // ==========================================================================
  // Health & Status
  // ==========================================================================

  /**
   * Check if API-Football is healthy by calling the status endpoint
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false
    }

    if (this.circuitBreaker.isOpen()) {
      return false
    }

    try {
      const response = await this.get<ApiFootballStatusResponse>('/status', undefined, {
        skipCache: true,
        cacheTtlSeconds: 0,
      })

      // API-Football status endpoint returns account info
      return response.results > 0
    } catch {
      return false
    }
  }

  /**
   * Get current API quota usage
   */
  async getQuotaUsage(): Promise<{ used: number; limit: number; remaining: number } | null> {
    try {
      const response = await this.get<ApiFootballStatusResponse>('/status', undefined, {
        cacheTtlSeconds: 60, // Cache for 1 minute
      })

      if (response.response?.account) {
        const account = response.response.account
        return {
          used: account.requests?.current || 0,
          limit: account.requests?.limit_day || 100,
          remaining: (account.requests?.limit_day || 100) - (account.requests?.current || 0),
        }
      }
    } catch (error) {
      console.warn('[ApiFootball] Failed to get quota usage:', error)
    }

    return null
  }

  /**
   * Get local daily quota status (no API call needed)
   */
  getDailyQuotaStatus(): { used: number; limit: number; remaining: number } {
    return this.dailyQuotaTracker.getStatus()
  }

  /**
   * Get today's usage statistics from our tracking table
   */
  async getTodayUsageStats(): Promise<{
    totalRequests: number
    cachedRequests: number
    errorCount: number
    avgResponseTimeMs: number
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const stats = await prisma.api_football_usage.aggregate({
      where: {
        created_at: { gte: today },
      },
      _count: true,
      _avg: {
        response_time_ms: true,
      },
    })

    const cachedCount = await prisma.api_football_usage.count({
      where: {
        created_at: { gte: today },
        cached: true,
      },
    })

    const errorCount = await prisma.api_football_usage.count({
      where: {
        created_at: { gte: today },
        status_code: { gte: 400 },
      },
    })

    return {
      totalRequests: stats._count,
      cachedRequests: cachedCount,
      errorCount,
      avgResponseTimeMs: Math.round(stats._avg.response_time_ms || 0),
    }
  }

  /**
   * Clear cache for a specific endpoint or all endpoints
   */
  async clearCache(endpoint?: string): Promise<number> {
    // Clear memory cache
    if (endpoint) {
      // Clear matching keys from memory cache
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(endpoint)) {
          this.memoryCache.delete(key)
        }
      }
    } else {
      this.memoryCache.clear()
    }

    // Clear database cache
    try {
      const where = endpoint ? { endpoint } : {}
      const result = await prisma.api_football_cache.deleteMany({ where })
      console.log(
        `[ApiFootball] Cleared ${result.count} cache entries${endpoint ? ` for ${endpoint}` : ''}`
      )
      return result.count
    } catch (error) {
      console.error('[ApiFootball] Failed to clear database cache:', error)
      return 0
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: ApiFootballClient | null = null

export function getApiFootballClient(): ApiFootballClient {
  if (!clientInstance) {
    clientInstance = new ApiFootballClient()
  }
  return clientInstance
}
