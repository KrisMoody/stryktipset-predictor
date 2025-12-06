import type { Page } from 'playwright'
import { BaseScraper } from './base-scraper'
import type { StatisticsData } from '~/types'

/**
 * Extended statistics data including league table info
 */
export interface ExtendedStatisticsData extends StatisticsData {
  leagueTable?: LeagueTableEntry[]
}

export interface LeagueTableEntry {
  position: number
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  isHomeTeam?: boolean
  isAwayTeam?: boolean
}

/**
 * Scraper for Statistics tab (league table, team form, standings)
 * Navigates to /stryktipset/statistik to get league standings
 */
export class StatisticsScraper extends BaseScraper {
  /**
   * DOM-based scraping method
   */
  async scrape(page: Page, matchId: number, drawNumber: number, matchNumber: number): Promise<ExtendedStatisticsData | null> {
    try {
      this.log('Starting statistics scraping')

      // Navigate to match page
      const url = `https://www.svenskaspel.se/stryktipset/${drawNumber}/${matchNumber}`
      await this.navigateTo(page, url)

      // Click on Statistics tab (in the sub-navigation)
      // The tab is identified by data-test-id="statistic-menu-statistic" or link to /stryktipset/statistik
      const statsTabSelector = '[data-test-id="statistic-menu-statistic"], a[href*="/statistik"], a:has-text("Statistik"):not([data-testid="side-nav-menu-statistic"])'
      if (await this.elementExists(page, statsTabSelector)) {
        await this.clickTab(page, statsTabSelector)
      }
      else {
        this.log('Statistics tab not found, trying direct navigation')
        await this.navigateTo(page, `https://www.svenskaspel.se/stryktipset/statistik`)
      }

      // Wait for statistics content to load - look for league table
      await page.waitForSelector('.statistics-section, table[class*="table"], [class*="league-table"]', { timeout: 10000 })

      // Extract league table data
      const leagueTable = await this.extractLeagueTable(page)

      // Extract team-specific statistics
      const statisticsData: ExtendedStatisticsData = {
        homeTeam: await this.extractTeamStats(page, 'home', leagueTable),
        awayTeam: await this.extractTeamStats(page, 'away', leagueTable),
        leagueTable,
      }

      this.log('Statistics scraping complete')
      return statisticsData
    }
    catch (error) {
      this.log(`Error scraping statistics: ${error}`)
      return null
    }
  }

  /**
   * Extract league table from the statistics page
   */
  private async extractLeagueTable(page: Page): Promise<LeagueTableEntry[]> {
    const entries: LeagueTableEntry[] = []

    try {
      // Look for table rows in league standings
      const tableRows = await page.locator('table tbody tr, .league-table-row, [class*="standings"] tr').all()

      for (const row of tableRows) {
        const cells = await row.locator('td, [class*="cell"]').allTextContents()

        // Typical league table: Pos, Team, P, W, D, L, GF, GA, GD, Pts
        if (cells.length >= 8) {
          const entry: LeagueTableEntry = {
            position: parseInt(cells[0]?.trim() || '0') || 0,
            team: cells[1]?.trim() || '',
            played: parseInt(cells[2]?.trim() || '0') || 0,
            won: parseInt(cells[3]?.trim() || '0') || 0,
            drawn: parseInt(cells[4]?.trim() || '0') || 0,
            lost: parseInt(cells[5]?.trim() || '0') || 0,
            goalsFor: parseInt(cells[6]?.trim() || '0') || 0,
            goalsAgainst: parseInt(cells[7]?.trim() || '0') || 0,
            goalDifference: parseInt(cells[8]?.trim() || '0') || 0,
            points: parseInt(cells[9]?.trim() || cells[cells.length - 1]?.trim() || '0') || 0,
          }

          if (entry.team) {
            entries.push(entry)
          }
        }
      }

      this.log(`Extracted ${entries.length} league table entries`)
    }
    catch (error) {
      this.log(`Error extracting league table: ${error}`)
    }

    return entries
  }

  /**
   * Extract statistics for a specific team from league table
   */
  private async extractTeamStats(page: Page, side: 'home' | 'away', leagueTable: LeagueTableEntry[]): Promise<any> {
    try {
      const data: any = {}

      // Try to find team name from page to match against league table
      const teamNameSelector = side === 'home'
        ? '.match-header-home, [class*="home-team"], .participant-home'
        : '.match-header-away, [class*="away-team"], .participant-away'

      const teamName = await this.extractText(page, teamNameSelector)

      if (teamName && leagueTable.length > 0) {
        // Find team in league table (fuzzy match)
        const teamEntry = leagueTable.find(entry =>
          entry.team.toLowerCase().includes(teamName.toLowerCase())
          || teamName.toLowerCase().includes(entry.team.toLowerCase()),
        )

        if (teamEntry) {
          data.position = teamEntry.position
          data.points = teamEntry.points
          data.played = teamEntry.played
          data.won = teamEntry.won
          data.drawn = teamEntry.drawn
          data.lost = teamEntry.lost
          data.goalsFor = teamEntry.goalsFor
          data.goalsAgainst = teamEntry.goalsAgainst
          data.goalDifference = teamEntry.goalDifference

          this.log(`Found ${side} team "${teamName}" at position ${teamEntry.position}`)
        }
      }

      // Extract form (W/D/L sequence) if available
      const formSelector = `[class*="form"][class*="${side}"], .${side}-form, [data-team="${side}"] [class*="form"]`
      if (await this.elementExists(page, formSelector)) {
        const formElements = await page.locator(`${formSelector} [class*="result"], ${formSelector} span`).allTextContents()
        if (formElements.length > 0) {
          data.form = formElements
            .map(f => f.trim().toUpperCase())
            .filter(c => ['W', 'D', 'L', 'V', 'O', 'F'].includes(c))
        }
      }

      return data
    }
    catch (error) {
      this.log(`Error extracting ${side} team statistics: ${error}`)
      return {}
    }
  }
}
