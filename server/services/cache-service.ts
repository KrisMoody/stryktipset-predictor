import NodeCache from 'node-cache'

/**
 * Core caching service with day-aware TTL logic
 *
 * Implements in-memory caching with automatic TTL based on day of week:
 * - Saturday: 5 minutes (coupon deadline day, need fresh data)
 * - Other days: 24 hours (weekday traffic, stale data acceptable)
 */
class CacheService {
  private cache: NodeCache
  private inflightRequests: Map<string, Promise<unknown>>

  constructor() {
    // Initialize with default 5min TTL and 10min cleanup period
    this.cache = new NodeCache({
      stdTTL: 300,
      checkperiod: 600,
      useClones: false, // Better performance, we control data immutability
    })

    this.inflightRequests = new Map()

    // Log cache events
    this.cache.on('set', (key, _value) => {
      console.log(`[Cache] SET: ${key}`)
    })

    this.cache.on('del', (key, _value) => {
      console.log(`[Cache] DEL: ${key}`)
    })

    this.cache.on('expired', (key, _value) => {
      console.log(`[Cache] EXPIRED: ${key}`)
    })
  }

  /**
   * Get current day-aware TTL in seconds based on Stockholm timezone
   *
   * @returns TTL in seconds (300 for Saturday, 86400 for other days)
   */
  getCacheTTL(): number {
    try {
      // Get current time in Stockholm timezone
      const stockholmTime = new Date().toLocaleString('en-US', {
        timeZone: 'Europe/Stockholm',
      })
      const swedenDate = new Date(stockholmTime)
      const dayOfWeek = swedenDate.getDay() // 0 = Sunday, 6 = Saturday

      const ttl = dayOfWeek === 6 ? 300 : 86400 // 5 minutes on Saturday, 24 hours otherwise

      const dayName = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ][dayOfWeek]
      console.log(`[Cache] Day-aware TTL: ${dayName} → ${ttl}s (${ttl / 60}min)`)

      return ttl
    } catch (error) {
      console.error('[Cache] Error calculating TTL, defaulting to 5 minutes:', error)
      return 300 // Safe default
    }
  }

  /**
   * Get value from cache
   *
   * @param key Cache key
   * @returns Cached value or undefined if not found
   */
  get<T>(key: string): T | undefined {
    try {
      const value = this.cache.get<T>(key)
      if (value !== undefined) {
        console.log(`[Cache] HIT: ${key}`)
      } else {
        console.log(`[Cache] MISS: ${key}`)
      }
      return value
    } catch (error) {
      console.error(`[Cache] Error reading cache key ${key}:`, error)
      return undefined
    }
  }

  /**
   * Set value in cache with optional TTL
   *
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Optional TTL in seconds (uses day-aware TTL if not provided)
   */
  set<T>(key: string, value: T, ttl?: number): void {
    try {
      const effectiveTTL = ttl ?? this.getCacheTTL()
      this.cache.set(key, value, effectiveTTL)
    } catch (error) {
      console.error(`[Cache] Error setting cache key ${key}:`, error)
    }
  }

  /**
   * Delete value from cache
   *
   * @param key Cache key
   */
  del(key: string): void {
    try {
      this.cache.del(key)
    } catch (error) {
      console.error(`[Cache] Error deleting cache key ${key}:`, error)
    }
  }

  /**
   * Delete multiple keys matching a pattern
   *
   * @param pattern String pattern to match (e.g., "draw:" matches all draw keys)
   */
  delPattern(pattern: string): void {
    try {
      const keys = this.cache.keys()
      const matchingKeys = keys.filter(key => key.includes(pattern))

      if (matchingKeys.length > 0) {
        this.cache.del(matchingKeys)
        console.log(`[Cache] Deleted ${matchingKeys.length} keys matching pattern: ${pattern}`)
      }
    } catch (error) {
      console.error(`[Cache] Error deleting pattern ${pattern}:`, error)
    }
  }

  /**
   * Clear all cache
   */
  flush(): void {
    try {
      this.cache.flushAll()
      console.log('[Cache] Flushed all cache')
    } catch (error) {
      console.error('[Cache] Error flushing cache:', error)
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Object with cache stats
   */
  getStats() {
    return {
      keys: this.cache.keys().length,
      stats: this.cache.getStats(),
      inflightRequests: this.inflightRequests.size,
    }
  }

  /**
   * Wrap a function with cache and stampede prevention
   *
   * This prevents multiple concurrent requests from all fetching the same data.
   * Only one request will execute the fetcher, others will wait for the result.
   *
   * @param key Cache key
   * @param fetcher Function that fetches the data if not cached
   * @returns Cached or freshly fetched data
   */
  async wrap<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key)
    if (cached !== undefined) {
      return cached
    }

    // Check if request is already in-flight (stampede prevention)
    if (this.inflightRequests.has(key)) {
      console.log(`[Cache] Waiting for in-flight request: ${key}`)
      return (await this.inflightRequests.get(key)) as T
    }

    // Fetch data
    const promise = fetcher()
    this.inflightRequests.set(key, promise)

    try {
      const data = await promise
      const ttl = this.getCacheTTL()
      this.set(key, data, ttl)
      return data
    } finally {
      this.inflightRequests.delete(key)
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService()
