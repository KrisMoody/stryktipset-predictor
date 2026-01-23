import type { ScraperAnalytics, ScrapingMethod, UrlPattern } from '~/types'

/**
 * Analytics tracker for scraping operations
 * Tracks success rates, methods, domains, and performance metrics
 */
export class ScraperAnalyticsTracker {
  private analytics: ScraperAnalytics[] = []
  private maxStoredEvents = 1000 // Store last 1000 events

  /**
   * Record a scraping operation
   */
  record(data: {
    method: ScrapingMethod
    urlPattern: UrlPattern
    domain: string
    dataType: string
    success: boolean
    duration: number
    error?: string
  }): void {
    const event: ScraperAnalytics = {
      ...data,
      timestamp: new Date(),
    }

    this.analytics.push(event)

    // Keep only recent events
    if (this.analytics.length > this.maxStoredEvents) {
      this.analytics.shift()
    }
  }

  /**
   * Get success rate by method
   */
  getSuccessRateByMethod(): Record<ScrapingMethod, number> {
    const methods: Record<string, { total: number; success: number }> = {}

    for (const event of this.analytics) {
      if (!methods[event.method]) {
        methods[event.method] = { total: 0, success: 0 }
      }
      const methodStats = methods[event.method]
      if (methodStats) {
        methodStats.total++
        if (event.success) {
          methodStats.success++
        }
      }
    }

    const rates: Record<ScrapingMethod, number> = {} as Record<ScrapingMethod, number>
    for (const [method, stats] of Object.entries(methods)) {
      rates[method as ScrapingMethod] = stats.total > 0 ? (stats.success / stats.total) * 100 : 0
    }

    return rates
  }

  /**
   * Get success rate by URL pattern
   */
  getSuccessRateByPattern(): Record<UrlPattern, number> {
    const patterns: Record<string, { total: number; success: number }> = {}

    for (const event of this.analytics) {
      if (!patterns[event.urlPattern]) {
        patterns[event.urlPattern] = { total: 0, success: 0 }
      }
      const patternStats = patterns[event.urlPattern]
      if (patternStats) {
        patternStats.total++
        if (event.success) {
          patternStats.success++
        }
      }
    }

    const rates: Record<UrlPattern, number> = {} as Record<UrlPattern, number>
    for (const [pattern, stats] of Object.entries(patterns)) {
      rates[pattern as UrlPattern] = stats.total > 0 ? (stats.success / stats.total) * 100 : 0
    }

    return rates
  }

  /**
   * Get success rate by domain
   */
  getSuccessRateByDomain(): Record<string, number> {
    const domains: Record<string, { total: number; success: number }> = {}

    for (const event of this.analytics) {
      if (!domains[event.domain]) {
        domains[event.domain] = { total: 0, success: 0 }
      }
      const domainStats = domains[event.domain]
      if (domainStats) {
        domainStats.total++
        if (event.success) {
          domainStats.success++
        }
      }
    }

    const rates: Record<string, number> = {}
    for (const [domain, stats] of Object.entries(domains)) {
      rates[domain] = stats.total > 0 ? (stats.success / stats.total) * 100 : 0
    }

    return rates
  }

  /**
   * Get average duration by method
   */
  getAverageDurationByMethod(): Record<ScrapingMethod, number> {
    const methods: Record<string, { total: number; duration: number }> = {}

    for (const event of this.analytics) {
      if (!methods[event.method]) {
        methods[event.method] = { total: 0, duration: 0 }
      }
      const methodStats = methods[event.method]
      if (methodStats) {
        methodStats.total++
        methodStats.duration += event.duration
      }
    }

    const averages: Record<string, number> = {}
    for (const [method, stats] of Object.entries(methods)) {
      averages[method] = stats.total > 0 ? Math.round(stats.duration / stats.total) : 0
    }

    return averages
  }

  /**
   * Get average duration by data type
   */
  getAverageDurationByDataType(): Record<string, number> {
    const dataTypes: Record<string, { total: number; duration: number }> = {}

    for (const event of this.analytics) {
      if (!dataTypes[event.dataType]) {
        dataTypes[event.dataType] = { total: 0, duration: 0 }
      }
      const dataTypeStats = dataTypes[event.dataType]
      if (dataTypeStats) {
        dataTypeStats.total++
        dataTypeStats.duration += event.duration
      }
    }

    const averages: Record<string, number> = {}
    for (const [dataType, stats] of Object.entries(dataTypes)) {
      averages[dataType] = stats.total > 0 ? Math.round(stats.duration / stats.total) : 0
    }

    return averages
  }

  /**
   * Get recent failures
   */
  getRecentFailures(limit: number = 10): ScraperAnalytics[] {
    return this.analytics
      .filter(event => !event.success)
      .slice(-limit)
      .reverse()
  }

  /**
   * Get common errors
   */
  getCommonErrors(limit: number = 5): Array<{ error: string; count: number }> {
    const errors: Record<string, number> = {}

    for (const event of this.analytics) {
      if (!event.success && event.error) {
        errors[event.error] = (errors[event.error] || 0) + 1
      }
    }

    return Object.entries(errors)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalOperations: number
    successfulOperations: number
    failedOperations: number
    overallSuccessRate: number
    averageDuration: number
    methodStats: Record<ScrapingMethod, number>
    patternStats: Record<UrlPattern, number>
    domainStats: Record<string, number>
  } {
    const total = this.analytics.length
    const successful = this.analytics.filter(e => e.success).length
    const failed = total - successful
    const totalDuration = this.analytics.reduce((sum, e) => sum + e.duration, 0)

    return {
      totalOperations: total,
      successfulOperations: successful,
      failedOperations: failed,
      overallSuccessRate: total > 0 ? (successful / total) * 100 : 0,
      averageDuration: total > 0 ? Math.round(totalDuration / total) : 0,
      methodStats: this.getSuccessRateByMethod(),
      patternStats: this.getSuccessRateByPattern(),
      domainStats: this.getSuccessRateByDomain(),
    }
  }

  /**
   * Log summary to console
   */
  logSummary(): void {
    const summary = this.getSummary()

    console.log('\n=== Scraper Analytics Summary ===')
    console.log(`Total Operations: ${summary.totalOperations}`)
    console.log(
      `Successful: ${summary.successfulOperations} (${summary.overallSuccessRate.toFixed(2)}%)`
    )
    console.log(`Failed: ${summary.failedOperations}`)
    console.log(`Average Duration: ${summary.averageDuration}ms`)

    console.log('\nSuccess Rate by Method:')
    for (const [method, rate] of Object.entries(summary.methodStats)) {
      console.log(`  ${method}: ${rate.toFixed(2)}%`)
    }

    console.log('\nSuccess Rate by URL Pattern:')
    for (const [pattern, rate] of Object.entries(summary.patternStats)) {
      console.log(`  ${pattern}: ${rate.toFixed(2)}%`)
    }

    console.log('\nSuccess Rate by Domain:')
    for (const [domain, rate] of Object.entries(summary.domainStats)) {
      console.log(`  ${domain}: ${rate.toFixed(2)}%`)
    }

    const commonErrors = this.getCommonErrors()
    if (commonErrors.length > 0) {
      console.log('\nCommon Errors:')
      for (const { error, count } of commonErrors) {
        console.log(`  ${error}: ${count} times`)
      }
    }

    console.log('================================\n')
  }

  /**
   * Clear all analytics
   */
  clear(): void {
    this.analytics = []
  }

  /**
   * Get raw analytics data
   */
  getRawData(): ScraperAnalytics[] {
    return [...this.analytics]
  }
}

// Export singleton instance
export const scraperAnalytics = new ScraperAnalyticsTracker()
