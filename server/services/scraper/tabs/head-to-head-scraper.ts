import type { Page } from 'playwright'
import { BaseScraper } from './base-scraper'
import type { HeadToHeadData } from '~/types'

/**
 * Scraper for Head-to-Head tab (historical matchups between teams)
 */
export class HeadToHeadScraper extends BaseScraper {
  /**
   * DOM-based scraping method
   */
  async scrape(page: Page, matchId: number, drawNumber: number, matchNumber: number): Promise<HeadToHeadData | null> {
    try {
      this.log('Starting head-to-head scraping')

      // Navigate to match page if not already there
      const url = `https://www.svenskaspel.se/stryktipset/${drawNumber}/${matchNumber}`
      await this.navigateTo(page, url)

      // Click on Head-to-Head tab
      const h2hTabSelector = '[data-tab-id="headToHead"], button:has-text("Head to Head"), a:has-text("Head to Head")'
      if (await this.elementExists(page, h2hTabSelector)) {
        await this.clickTab(page, h2hTabSelector)
      }
      else {
        this.log('Head-to-Head tab not found')
        return null
      }

      // Wait for H2H content to load
      await page.waitForSelector('[class*="head"], [class*="h2h"], table', { timeout: 10000 })

      // Extract head-to-head matches
      const matches = await this.extractMatches(page)

      const h2hData: HeadToHeadData = {
        matches,
        summary: this.calculateSummary(matches),
      }

      this.log('Head-to-head scraping complete')
      return h2hData
    }
    catch (error) {
      this.log(`Error scraping head-to-head: ${error}`)
      return null
    }
  }

  /**
   * Extract historical matches
   */
  private async extractMatches(page: Page): Promise<any[]> {
    try {
      const matches: any[] = []

      // Try to find match rows in a table
      const rows = await page.locator('table tbody tr, [class*="match-row"]').all()

      for (const row of rows) {
        const cells = await row.locator('td, [class*="cell"]').allTextContents()

        if (cells.length >= 3) {
          matches.push({
            date: cells[0]?.trim() || '',
            homeTeam: cells[1]?.trim() || '',
            score: cells[2]?.trim() || '',
            awayTeam: cells[3]?.trim() || '',
            competition: cells[4]?.trim() || undefined,
          })
        }
      }

      this.log(`Found ${matches.length} historical matches`)
      return matches
    }
    catch (error) {
      this.log(`Error extracting matches: ${error}`)
      return []
    }
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(matches: any[]): any {
    let homeWins = 0
    let draws = 0
    let awayWins = 0

    for (const match of matches) {
      if (match.score) {
        const scoreParts = match.score.split('-')
        if (scoreParts.length === 2) {
          const home = parseInt(scoreParts[0])
          const away = parseInt(scoreParts[1])

          if (home > away) homeWins++
          else if (home < away) awayWins++
          else draws++
        }
      }
    }

    return {
      homeWins,
      draws,
      awayWins,
      totalMatches: matches.length,
    }
  }
}
