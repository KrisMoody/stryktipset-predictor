/**
 * Centralized configuration for the scraping system
 */

export const scraperConfig = {
  /**
   * Domain configuration
   */
  domains: {
    primary: 'https://spela.svenskaspel.se',
    fallback: 'https://www.svenskaspel.se',
    testOnStartup: true,
  },

  /**
   * Timeout values (milliseconds)
   */
  timeouts: {
    directUrl: 5000, // Timeout for direct URL navigation
    tabClick: 10000, // Timeout for tab-clicking method
    snapshot: 3000, // Timeout for accessibility snapshot
    domQuery: 2000, // Timeout for individual DOM queries
    pageLoad: 15000, // Timeout for full page load
  },

  /**
   * Human-like behavior delays (milliseconds)
   */
  delays: {
    betweenPages: { min: 2000, max: 3000 }, // Delay between navigating to different pages
    betweenTabs: { min: 3000, max: 5000 }, // Delay between clicking tabs
    afterClick: { min: 1000, max: 2000 }, // Delay after clicking
    afterNavigation: { min: 1500, max: 2500 }, // Delay after page navigation
    onRateLimit: { min: 30000, max: 60000 }, // Delay when rate limited
  },

  /**
   * Retry configuration
   */
  retries: {
    maxAttempts: 3, // Maximum retry attempts per operation
    exponentialBackoff: true, // Use exponential backoff
    baseDelay: 2000, // Base delay for exponential backoff (ms)
    maxDelay: 30000, // Maximum delay between retries (ms)
    retryOnRateLimit: true, // Retry when rate limited
    rateLimitMaxAttempts: 2, // Max attempts when rate limited
  },

  /**
   * Rate limit detection
   */
  rateLimit: {
    detectOnStatus: [429, 503], // HTTP status codes that indicate rate limiting
    detectPatterns: [ // Text patterns that indicate rate limiting
      /rate limit/i,
      /too many requests/i,
      /try again later/i,
      /captcha/i,
      /cloudflare/i,
      /access denied/i,
    ],
    backoffMultiplier: 3, // Multiply delay by this on rate limit
    maxBackoffTime: 180000, // Maximum backoff time (3 minutes)
  },

  /**
   * Data type priorities
   */
  dataTypes: {
    order: ['statistics', 'xStats', 'headToHead', 'news'], // Order to scrape
    required: ['statistics', 'xStats'], // Required data types
    optional: ['headToHead', 'news'], // Optional data types
  },

  /**
   * Scraping methods
   */
  methods: {
    preferDirectUrl: true, // Prefer direct URL navigation over tab clicking
    useAccessibilityTree: true, // Use accessibility tree for extraction
    fallbackToDom: true, // Fall back to DOM queries if accessibility fails
    fallbackToTabClick: true, // Fall back to tab clicking if direct URL fails
    tryAlternateDomain: true, // Try alternate domain on failure
  },

  /**
   * Draw lifecycle configuration
   */
  drawLifecycle: {
    archiveOnComplete: true, // Archive draws when completed
    archiveDelay: 86400000, // Delay before archiving (24 hours)
    checkInterval: 3600000, // How often to check for completed draws (1 hour)
    archiveCriteria: {
      statusMustBe: 'Completed', // Draw status must be this
      allMatchesHaveResults: true, // All matches must have results
    },
  },

  /**
   * Analytics configuration
   */
  analytics: {
    enabled: true, // Track scraping analytics
    trackMethods: true, // Track which methods succeed/fail
    trackDomains: true, // Track which domains work best
    trackDurations: true, // Track operation durations
    logToConsole: true, // Log analytics to console
    logToDatabase: false, // Store analytics in database (future)
  },

  /**
   * Debug configuration
   */
  debug: {
    logUrls: true, // Log constructed URLs
    logSnapshots: false, // Log accessibility snapshots (verbose)
    logDiscoveredUrls: true, // Log URLs found in accessibility tree
    logFallbacks: true, // Log when fallback methods are used
    logTimings: true, // Log operation timings
  },

  /**
   * Feature flags
   */
  features: {
    urlDiscovery: true, // Discover URLs from accessibility tree
    domainTesting: true, // Test domains on startup
    adaptiveRetries: true, // Adjust retry strategy based on errors
    smartCaching: true, // Cache discovered URLs and working domains
  },
} as const

/**
 * Get delay value with randomization
 */
export function getRandomDelay(config: { min: number, max: number }): number {
  return Math.floor(Math.random() * (config.max - config.min + 1)) + config.min
}

/**
 * Calculate exponential backoff delay
 */
export function getExponentialBackoff(attemptNumber: number): number {
  const { baseDelay, maxDelay, exponentialBackoff } = scraperConfig.retries

  if (!exponentialBackoff) {
    return baseDelay
  }

  const delay = baseDelay * Math.pow(2, attemptNumber - 1)
  return Math.min(delay, maxDelay)
}

/**
 * Calculate rate limit backoff delay
 */
export function getRateLimitBackoff(attemptNumber: number): number {
  const { backoffMultiplier, maxBackoffTime } = scraperConfig.rateLimit
  const baseDelay = scraperConfig.retries.baseDelay

  const delay = baseDelay * Math.pow(backoffMultiplier, attemptNumber)
  return Math.min(delay, maxBackoffTime)
}

/**
 * Check if error matches rate limit pattern
 */
export function isRateLimitError(error: Error | string): boolean {
  const message = typeof error === 'string' ? error : error.message

  return scraperConfig.rateLimit.detectPatterns.some(pattern =>
    pattern.test(message),
  )
}

/**
 * Get timeout for operation type
 */
export function getTimeout(operationType: 'directUrl' | 'tabClick' | 'snapshot' | 'domQuery' | 'pageLoad'): number {
  return scraperConfig.timeouts[operationType]
}
