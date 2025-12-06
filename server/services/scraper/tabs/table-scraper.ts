import type { Page } from 'playwright'
import { BaseScraper } from './base-scraper'

/**
 * League table entry from Enetpulse widget
 */
export interface LeagueTableEntry {
  position: number
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  goalDifference: number
  points: number
  isHighlighted?: boolean // True if this is one of the match teams
  positionMarker?: string // e.g., "championsleague", "uefacup", "relegation"
}

/**
 * Complete table data from Tabell tab
 */
export interface TableData {
  entries: LeagueTableEntry[]
  standingType: 'total' | 'home' | 'away'
  homeTeamPosition?: number
  awayTeamPosition?: number
}

/**
 * Scraper for the Tabell (Table) tab
 * Extracts league standings from the Enetpulse widget
 *
 * HTML Structure (Enetpulse widget):
 * - #enetpulse-container - Widget container
 * - .wff_standings_generic_root - Main standings widget
 * - .wff_standings_tabs_container - Tabs for Totalt/Hemma/Borta
 * - .wff_standings_table - The standings table
 * - .wff_standings_table_row - Each team row
 * - .wff_standings_position - Position column
 * - .wff_standings_team .wff_participant_name - Team name
 * - .wff_standings_stats_box - Stats columns (M, V, O, F, +/-, P)
 * - .wff_highlight_event_selected_row - Highlighted match team
 * - .wff_standing_position_marker_strip - Position marker (CL, EL, relegation)
 */
export class TableScraper extends BaseScraper {
  /**
   * DOM-based scraping method
   */
  async scrape(
    page: Page,
    _matchId: number,
    drawNumber: number,
    matchNumber: number
  ): Promise<TableData | null> {
    try {
      this.log('Starting table scraping')

      // Navigate to match page's Tabell tab
      const url = `https://www.svenskaspel.se/stryktipset/${drawNumber}/${matchNumber}/tabell`
      await this.navigateTo(page, url)

      // Wait for the Enetpulse widget to load
      await page.waitForSelector(
        '#enetpulse-container .wff_standings_table_row, .wff_standings_generic_root',
        { timeout: 15000 }
      )

      // Give the widget extra time to fully render
      await this.humanDelay(1000, 2000)

      // Get current standing type (Totalt is default)
      const standingType = await this.getSelectedStandingType(page)

      // Extract table entries
      const entries = await this.extractTableEntries(page)

      // Find highlighted teams (the teams in the current match)
      const homeTeamPosition = entries.find(e => e.isHighlighted)?.position
      const awayTeamPosition = entries.filter(e => e.isHighlighted)[1]?.position

      const tableData: TableData = {
        entries,
        standingType,
        homeTeamPosition,
        awayTeamPosition,
      }

      this.log(`Table scraping complete: ${entries.length} teams, type: ${standingType}`)
      return tableData
    } catch (error) {
      this.log(`Error scraping table: ${error}`)
      return null
    }
  }

  /**
   * Get the currently selected standing type (Totalt/Hemma/Borta)
   */
  private async getSelectedStandingType(page: Page): Promise<'total' | 'home' | 'away'> {
    try {
      const selectedTab = await page
        .locator('.wff_standing_type_tab.wff_selected_tab .wff_label_text')
        .textContent()

      if (selectedTab?.toLowerCase().includes('hemma')) return 'home'
      if (selectedTab?.toLowerCase().includes('borta')) return 'away'
      return 'total'
    } catch {
      return 'total'
    }
  }

  /**
   * Extract all league table entries from Enetpulse widget
   */
  private async extractTableEntries(page: Page): Promise<LeagueTableEntry[]> {
    const entries: LeagueTableEntry[] = []

    try {
      // Find all table rows
      const rows = await page.locator('.wff_standings_table_row').all()

      for (const row of rows) {
        try {
          // Check if this row is highlighted (one of the match teams)
          const isHighlighted = await row.evaluate((el: Element) =>
            el.classList.contains('wff_highlight_event_selected_row')
          )

          // Extract position from .wff_standings_position
          const positionCell = row.locator('.wff_standings_position')
          const positionText = await positionCell.locator('div[tabindex="0"]').textContent()
          const position = parseInt(positionText?.trim() || '0') || 0

          // Extract position marker (championsleague, uefacup, relegation, etc.)
          const markerStrip = row.locator('.wff_standing_position_marker_strip')
          const markerClass = await markerStrip.getAttribute('class')
          let positionMarker: string | undefined
          if (markerClass) {
            const markerMatch = markerClass.match(/wff_(\w+)$/)
            if (
              markerMatch &&
              markerMatch[1] &&
              markerMatch[1] !== 'standing_position_marker_strip'
            ) {
              positionMarker = markerMatch[1]
            }
          }

          // Extract team name from .wff_participant_name
          const teamName = await row.locator('.wff_participant_name').textContent()

          // Extract stats from .wff_standings_stats_box cells
          // Order: M (played), V (won), O (drawn), F (lost), +/- (goal diff), P (points)
          const statsCells = await row
            .locator('.wff_standings_stats_box div[tabindex="0"]')
            .allTextContents()

          if (teamName && statsCells.length >= 6) {
            const entry: LeagueTableEntry = {
              position,
              team: teamName.trim(),
              played: parseInt(statsCells[0]?.trim() || '0') || 0,
              won: parseInt(statsCells[1]?.trim() || '0') || 0,
              drawn: parseInt(statsCells[2]?.trim() || '0') || 0,
              lost: parseInt(statsCells[3]?.trim() || '0') || 0,
              goalDifference: this.parseGoalDifference(statsCells[4]?.trim() || '0'),
              points: parseInt(statsCells[5]?.trim() || '0') || 0,
              isHighlighted,
              positionMarker,
            }

            entries.push(entry)
          }
        } catch (innerError) {
          this.log(`Error extracting single table row: ${innerError}`)
        }
      }

      this.log(`Extracted ${entries.length} table entries`)
    } catch (error) {
      this.log(`Error extracting table entries: ${error}`)
    }

    return entries
  }

  /**
   * Parse goal difference string (e.g., "+19", "-5", "0") to number
   */
  private parseGoalDifference(value: string): number {
    const cleaned = value.replace('+', '').trim()
    return parseInt(cleaned) || 0
  }
}
