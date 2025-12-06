import type { Page } from 'playwright'
import { extractTabUrls, type AccessibilityNode } from './accessibility-helper'

/**
 * URL pattern type - determines which URL structure to use
 */
export type UrlPattern = 'current' | 'historic'

/**
 * Domain configuration
 */
export interface DomainConfig {
  primary: string
  fallback: string
  tested?: boolean
  working?: string
}

/**
 * Match and draw data for URL building
 */
export interface UrlBuildContext {
  matchNumber: number // 1-13
  drawNumber: number
  drawDate: Date
  isCurrent: boolean
}

/**
 * URL configuration manager
 * Handles both current and historic URL patterns
 */
export class UrlManager {
  private domains: DomainConfig = {
    primary: 'https://spela.svenskaspel.se',
    fallback: 'https://www.svenskaspel.se',
  }

  private workingDomain: string | null = null
  private discoveredUrls: Map<string, Record<string, string>> = new Map()

  /**
   * Current round URL patterns (for is_current = true)
   * Note: headToHead has no dedicated URL on svenskaspel.se - skip AI scraping for it
   */
  private currentPatterns = {
    statistics: '/stryktipset/statistik?event={matchNumber}',
    xStats: '/stryktipset/xstats?event={matchNumber}',
    news: '/stryktipset/nyheter?event={matchNumber}',
  }

  /**
   * Historic round URL patterns (for is_current = false)
   * Note: headToHead has no dedicated URL on svenskaspel.se - skip AI scraping for it
   */
  private historicPatterns = {
    statistics: '/stryktipset/resultat/{date}/statistik?draw={drawNumber}&product=1&event={matchNumber}',
    xStats: '/stryktipset/resultat/{date}/xstats?draw={drawNumber}&product=1&event={matchNumber}',
    news: '/stryktipset/resultat/{date}/nyheter?draw={drawNumber}&product=1&event={matchNumber}',
  }

  /**
   * Test domains to find which one works
   */
  async testDomains(page: Page): Promise<string> {
    if (this.workingDomain) {
      return this.workingDomain
    }

    console.log('[URL Manager] Testing domains...')

    // Try primary domain first
    try {
      const testUrl = `${this.domains.primary}/stryktipset`
      const response = await page.goto(testUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      })

      if (response && response.ok()) {
        console.log(`[URL Manager] Primary domain working: ${this.domains.primary}`)
        this.workingDomain = this.domains.primary
        return this.domains.primary
      }
    }
    catch (error) {
      console.log(`[URL Manager] Primary domain failed: ${error}`)
    }

    // Try fallback domain
    try {
      const testUrl = `${this.domains.fallback}/stryktipset`
      const response = await page.goto(testUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      })

      if (response && response.ok()) {
        console.log(`[URL Manager] Fallback domain working: ${this.domains.fallback}`)
        this.workingDomain = this.domains.fallback
        return this.domains.fallback
      }
    }
    catch (error) {
      console.log(`[URL Manager] Fallback domain failed: ${error}`)
    }

    // Default to primary if both failed
    console.log('[URL Manager] Both domains failed, using primary as default')
    this.workingDomain = this.domains.primary
    return this.domains.primary
  }

  /**
   * Build URL for a specific data type
   */
  buildUrl(dataType: string, context: UrlBuildContext): string {
    const domain = this.workingDomain || this.domains.primary
    const pattern = context.isCurrent
      ? this.currentPatterns[dataType as keyof typeof this.currentPatterns]
      : this.historicPatterns[dataType as keyof typeof this.historicPatterns]

    if (!pattern) {
      throw new Error(`Unknown data type: ${dataType}`)
    }

    // Replace placeholders
    let url = domain + pattern
    url = url.replace('{matchNumber}', String(context.matchNumber))
    url = url.replace('{drawNumber}', String(context.drawNumber))

    if (!context.isCurrent) {
      const dateStr = this.formatDate(context.drawDate)
      url = url.replace('{date}', dateStr)
    }

    return url
  }

  /**
   * Build all URLs for all data types
   * Note: headToHead excluded - no dedicated URL exists
   */
  buildAllUrls(context: UrlBuildContext): Record<string, string> {
    return {
      statistics: this.buildUrl('statistics', context),
      xStats: this.buildUrl('xStats', context),
      news: this.buildUrl('news', context),
    }
  }

  /**
   * Discover URLs from accessibility tree
   * Can be used to validate or update our hardcoded patterns
   */
  discoverUrls(snapshot: AccessibilityNode | null, matchId: number): Record<string, string> {
    const cacheKey = String(matchId)

    // Check cache first
    if (this.discoveredUrls.has(cacheKey)) {
      return this.discoveredUrls.get(cacheKey)!
    }

    // Extract URLs from accessibility tree
    const urls = extractTabUrls(snapshot)

    // Store in cache
    this.discoveredUrls.set(cacheKey, urls)

    console.log(`[URL Manager] Discovered URLs for match ${matchId}:`, urls)

    return urls
  }

  /**
   * Get URL with fallback logic
   * 1. Try discovered URL from accessibility tree
   * 2. Fall back to constructed URL
   */
  getUrl(
    dataType: string,
    context: UrlBuildContext,
    matchId: number,
  ): string {
    // Try discovered URL first
    const cacheKey = String(matchId)
    const discovered = this.discoveredUrls.get(cacheKey)

    if (discovered && discovered[dataType]) {
      console.log(`[URL Manager] Using discovered URL for ${dataType}`)
      return discovered[dataType]
    }

    // Fall back to constructed URL
    console.log(`[URL Manager] Using constructed URL for ${dataType}`)
    return this.buildUrl(dataType, context)
  }

  /**
   * Try alternate domain
   */
  getAlternateDomain(): string {
    if (this.workingDomain === this.domains.primary) {
      return this.domains.fallback
    }
    return this.domains.primary
  }

  /**
   * Build URL with alternate domain
   */
  buildUrlWithDomain(dataType: string, context: UrlBuildContext, domain: string): string {
    const originalDomain = this.workingDomain
    this.workingDomain = domain

    try {
      return this.buildUrl(dataType, context)
    }
    finally {
      this.workingDomain = originalDomain
    }
  }

  /**
   * Format date as YYYY-MM-DD for historic URLs
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * Clear cached URLs (call when switching draws)
   */
  clearCache(): void {
    this.discoveredUrls.clear()
  }

  /**
   * Reset working domain (force re-test)
   */
  resetDomain(): void {
    this.workingDomain = null
  }

  /**
   * Get current working domain
   */
  getCurrentDomain(): string {
    return this.workingDomain || this.domains.primary
  }

  /**
   * Check if URL is likely a rate limit or error page
   */
  isErrorUrl(url: string): boolean {
    return (
      !url.includes('svenskaspel.se')
      || url.includes('error')
      || url.includes('404')
      || url.includes('503')
    )
  }
}

// Export singleton instance
export const urlManager = new UrlManager()
