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
 * Extracted team statistics from league table and form
 */
interface TeamStats {
  position?: number
  points?: number
  played?: number
  won?: number
  drawn?: number
  lost?: number
  goalsFor?: number
  goalsAgainst?: number
  goalDifference?: number
  form?: string[]
}

/**
 * Scraper for Statistics tab (league table, team form, standings)
 * Supports all game types: stryktipset, europatipset, topptipset
 */
export class StatisticsScraper extends BaseScraper {
  /**
   * DOM-based scraping method
   */
  async scrape(
    page: Page,
    matchId: number,
    drawNumber: number,
    matchNumber: number,
    drawDate?: Date
  ): Promise<ExtendedStatisticsData | null> {
    try {
      this.log(`Starting statistics scraping for ${this.gameType}`)

      // Determine if this is a current or historic draw
      const isCurrent = !drawDate || this.isCurrentDraw(drawDate)

      // Build URL using URL Manager (correct domain and pattern for all game types)
      const url = this.buildUrl('statistics', {
        matchNumber,
        drawNumber,
        drawDate: drawDate || new Date(),
        isCurrent,
      })
      this.log(`Navigating to: ${url}`)
      await this.navigateTo(page, url)

      // Wait for statistics content to load - look for Enetpulse container or league table
      await page.waitForSelector(
        '#enetpulse-container, #tipsen-container, .statistics-section, table[class*="table"], [class*="league-table"]',
        { timeout: 10000 }
      )

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
    } catch (error) {
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
      const tableRows = await page
        .locator('table tbody tr, .league-table-row, [class*="standings"] tr')
        .all()

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
    } catch (error) {
      this.log(`Error extracting league table: ${error}`)
    }

    return entries
  }

  /**
   * Extract statistics for a specific team from league table
   */
  private async extractTeamStats(
    page: Page,
    side: 'home' | 'away',
    leagueTable: LeagueTableEntry[]
  ): Promise<TeamStats> {
    try {
      const data: TeamStats = {}

      // Try to find team name from page to match against league table
      // Discovered selectors: .home-participant, .away-participant (Enetpulse widget)
      const teamNameSelector =
        side === 'home'
          ? '.home-participant, .match-header-home, [class*="home-team"], .participant-home'
          : '.away-participant, .match-header-away, [class*="away-team"], .participant-away'

      const teamName = await this.extractText(page, teamNameSelector)

      if (teamName && leagueTable.length > 0) {
        // Find team in league table (fuzzy match)
        const teamEntry = leagueTable.find(
          entry =>
            entry.team.toLowerCase().includes(teamName.toLowerCase()) ||
            teamName.toLowerCase().includes(entry.team.toLowerCase())
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

      // Extract form (W/D/L sequence) from Enetpulse form indicators
      // Discovered selectors: .wff_circle_value_w (win), .wff_circle_value_d (draw), .wff_circle_value_l (loss)
      const formSection = page.locator(
        side === 'home'
          ? '.wff_h2h_generic_section_data.wff_home, [class*="home"] [class*="form"]'
          : '.wff_h2h_generic_section_data.wff_away, [class*="away"] [class*="form"]'
      )

      if ((await formSection.count()) > 0) {
        const form: string[] = []
        const formBalls = await formSection
          .locator('.wff_circle_value_w, .wff_circle_value_d, .wff_circle_value_l')
          .all()
        for (const ball of formBalls) {
          const cls = await ball.getAttribute('class')
          if (cls?.includes('wff_circle_value_w')) form.push('W')
          else if (cls?.includes('wff_circle_value_d')) form.push('D')
          else if (cls?.includes('wff_circle_value_l')) form.push('L')
        }
        if (form.length > 0) {
          data.form = form
          this.log(`Extracted form for ${side}: ${form.join('')}`)
        }
      }

      return data
    } catch (error) {
      this.log(`Error extracting ${side} team statistics: ${error}`)
      return {}
    }
  }
}
