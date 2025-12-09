import type { Page } from 'playwright'
import { extractTabUrls, type AccessibilityNode } from './accessibility-helper'
import type { GameType } from '~/types/game-types'
import { getGameConfig } from '~/server/constants/game-configs'

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
  matchNumber: number // 1-13 for Stryktipset/Europatipset, 1-8 for Topptipset
  drawNumber: number
  drawDate: Date
  isCurrent: boolean
  gameType?: GameType // Defaults to 'stryktipset' for backward compatibility
}

/**
 * URL configuration manager
 * Handles both current and historic URL patterns for all game types
 */
export class UrlManager {
  private domains: DomainConfig = {
    primary: 'https://spela.svenskaspel.se',
    fallback: 'https://www.svenskaspel.se',
  }

  private workingDomain: string | null = null
  private discoveredUrls: Map<string, Record<string, string>> = new Map()
  private currentGameType: GameType = 'stryktipset'

  /**
   * Get current URL patterns based on game type
   * Note: headToHead has no dedicated URL on svenskaspel.se - skip AI scraping for it
   */
  private getCurrentPatterns(gameType: GameType) {
    const basePath = getGameConfig(gameType).scrapeBasePath
    return {
      statistics: `${basePath}/statistik?event={matchNumber}`,
      xStats: `${basePath}/xstats?event={matchNumber}`,
      news: `${basePath}/nyheter?event={matchNumber}`,
    }
  }

  /**
   * Get historic URL patterns based on game type
   * Note: headToHead has no dedicated URL on svenskaspel.se - skip AI scraping for it
   */
  private getHistoricPatterns(gameType: GameType) {
    const config = getGameConfig(gameType)
    const basePath = config.scrapeBasePath
    return {
      statistics: `${basePath}/resultat/{date}/statistik?draw={drawNumber}&product=${config.productId}&event={matchNumber}`,
      xStats: `${basePath}/resultat/{date}/xstats?draw={drawNumber}&product=${config.productId}&event={matchNumber}`,
      news: `${basePath}/resultat/{date}/nyheter?draw={drawNumber}&product=${config.productId}&event={matchNumber}`,
    }
  }

  /**
   * Set the current game type for URL building
   */
  setGameType(gameType: GameType): void {
    this.currentGameType = gameType
    console.log(`[URL Manager] Game type set to: ${gameType}`)
  }

  /**
   * Get the current game type
   */
  getGameType(): GameType {
    return this.currentGameType
  }

  /**
   * Test domains to find which one works
   */
  async testDomains(page: Page, gameType?: GameType): Promise<string> {
    if (this.workingDomain) {
      return this.workingDomain
    }

    const testGameType = gameType || this.currentGameType
    const basePath = getGameConfig(testGameType).scrapeBasePath

    console.log(`[URL Manager] Testing domains for ${testGameType}...`)

    // Try primary domain first
    try {
      const testUrl = `${this.domains.primary}${basePath}`
      const response = await page.goto(testUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      })

      if (response && response.ok()) {
        console.log(`[URL Manager] Primary domain working: ${this.domains.primary}`)
        this.workingDomain = this.domains.primary
        return this.domains.primary
      }
    } catch (error) {
      console.log(`[URL Manager] Primary domain failed: ${error}`)
    }

    // Try fallback domain
    try {
      const testUrl = `${this.domains.fallback}${basePath}`
      const response = await page.goto(testUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      })

      if (response && response.ok()) {
        console.log(`[URL Manager] Fallback domain working: ${this.domains.fallback}`)
        this.workingDomain = this.domains.fallback
        return this.domains.fallback
      }
    } catch (error) {
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
    const gameType = context.gameType || this.currentGameType

    const patterns = context.isCurrent
      ? this.getCurrentPatterns(gameType)
      : this.getHistoricPatterns(gameType)

    const pattern = patterns[dataType as keyof typeof patterns]

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
  getUrl(dataType: string, context: UrlBuildContext, matchId: number): string {
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
    } finally {
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
      !url.includes('svenskaspel.se') ||
      url.includes('error') ||
      url.includes('404') ||
      url.includes('503')
    )
  }
}

// Export singleton instance
export const urlManager = new UrlManager()
