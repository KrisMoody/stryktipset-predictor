/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic scraped data structures */
import type { Page } from 'playwright'
import { BaseScraper } from './base-scraper'
import type { HeadToHeadData } from '~/types'

/**
 * Scraper for Head-to-Head data (historical matchups between teams)
 * Supports all game types: stryktipset, europatipset, topptipset
 *
 * IMPORTANT: H2H data is NOT on a separate tab!
 * It's embedded in the Statistik page using the Enetpulse H2H widget.
 *
 * Enetpulse H2H Widget Structure:
 * - .wff_h2h_generic - Main H2H container
 * - .wff_h2h_filter_header - Filter tabs (Hemma/Borta/Alla matcher)
 * - .wff_h2h_generic_section_data - Data sections for each team
 * - .wff_h2h_event_wrapper - Individual historical match events
 * - .wff_h2h_section_header - Section headers showing "Head 2 Head" with summary
 */
export class HeadToHeadScraper extends BaseScraper {
  /**
   * DOM-based scraping method
   * Navigates to Statistik page and extracts H2H widget data
   */
  async scrape(
    page: Page,
    _matchId: number,
    drawNumber: number,
    matchNumber: number,
    drawDate?: Date
  ): Promise<HeadToHeadData | null> {
    try {
      this.log(`Starting head-to-head scraping for ${this.gameType}`)

      // Determine if this is a current or historic draw
      const isCurrent = !drawDate || this.isCurrentDraw(drawDate)

      // H2H data is on the Statistik page, not a separate tab
      const url = this.buildUrl('statistics', {
        matchNumber,
        drawNumber,
        drawDate: drawDate || new Date(),
        isCurrent,
      })
      this.log(`Navigating to Statistik page for H2H data: ${url}`)
      await this.navigateTo(page, url)

      // Wait for the Enetpulse H2H widget to load
      const h2hSelectors = [
        '.wff_h2h_generic',
        '.wff_h2h_generic_soccer',
        '[class*="wff_h2h"]',
        '#enetpulse-container .wff_h2h_generic',
      ]

      let h2hFound = false
      for (const selector of h2hSelectors) {
        if (await this.elementExists(page, selector)) {
          await page.waitForSelector(selector, { timeout: 10000 })
          h2hFound = true
          this.log(`Found H2H widget with selector: ${selector}`)
          break
        }
      }

      if (!h2hFound) {
        this.log('H2H widget not found on Statistik page')
        return null
      }

      // Give widget time to fully render
      await this.humanDelay(1000, 1500)

      // Extract H2H summary from header
      const summary = await this.extractH2HSummary(page)

      // Extract historical matches from the widget
      const matches = await this.extractMatches(page)

      // Extract team form data
      const formData = await this.extractFormData(page)

      const h2hData: HeadToHeadData = {
        matches,
        summary: summary || this.calculateSummary(matches),
        homeTeamForm: formData.home,
        awayTeamForm: formData.away,
      }

      this.log(
        `Head-to-head scraping complete: ${matches.length} matches, summary: ${JSON.stringify(summary)}`
      )
      return h2hData
    } catch (error) {
      this.log(`Error scraping head-to-head: ${error}`)
      return null
    }
  }

  /**
   * Extract H2H summary from the widget header
   * Format: "Head 2 Head4 - 1 - 0" means 4 home wins, 1 draw, 0 away wins
   */
  private async extractH2HSummary(page: Page): Promise<any | null> {
    try {
      // Look for the H2H header which shows summary like "Head 2 Head4 - 1 - 0"
      const headerText = await page
        .locator('.wff_h2h_section_header, [class*="wff_h2h"] [class*="header"]')
        .filter({ hasText: 'Head 2 Head' })
        .first()
        .textContent()

      if (headerText) {
        // Extract numbers from "Head 2 Head4 - 1 - 0" format
        const match = headerText.match(/Head\s*2\s*Head\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/i)
        if (match) {
          const homeWins = parseInt(match[1] ?? '0', 10) || 0
          const draws = parseInt(match[2] ?? '0', 10) || 0
          const awayWins = parseInt(match[3] ?? '0', 10) || 0
          return {
            homeWins,
            draws,
            awayWins,
            totalMatches: homeWins + draws + awayWins,
          }
        }
      }

      return null
    } catch (error) {
      this.log(`Error extracting H2H summary: ${error}`)
      return null
    }
  }

  /**
   * Extract team form data (W/D/L sequence)
   */
  private async extractFormData(page: Page): Promise<{ home: string[]; away: string[] }> {
    const result = { home: [] as string[], away: [] as string[] }

    try {
      // Home team form is in the .wff_home section
      const homeSection = page.locator('.wff_h2h_generic_section_data.wff_home')
      if ((await homeSection.count()) > 0) {
        const formBalls = await homeSection
          .locator('.wff_stats_ball_container, [class*="wff_circle_value"]')
          .all()
        for (const ball of formBalls) {
          const cls = await ball.getAttribute('class')
          if (cls?.includes('wff_circle_value_w') || cls?.includes('win')) {
            result.home.push('W')
          } else if (cls?.includes('wff_circle_value_d') || cls?.includes('draw')) {
            result.home.push('D')
          } else if (cls?.includes('wff_circle_value_l') || cls?.includes('loss')) {
            result.home.push('L')
          }
        }
      }

      // Away team form is in the .wff_away section
      const awaySection = page.locator('.wff_h2h_generic_section_data.wff_away')
      if ((await awaySection.count()) > 0) {
        const formBalls = await awaySection
          .locator('.wff_stats_ball_container, [class*="wff_circle_value"]')
          .all()
        for (const ball of formBalls) {
          const cls = await ball.getAttribute('class')
          if (cls?.includes('wff_circle_value_w') || cls?.includes('win')) {
            result.away.push('W')
          } else if (cls?.includes('wff_circle_value_d') || cls?.includes('draw')) {
            result.away.push('D')
          } else if (cls?.includes('wff_circle_value_l') || cls?.includes('loss')) {
            result.away.push('L')
          }
        }
      }

      this.log(`Extracted form data: home=${result.home.join('')}, away=${result.away.join('')}`)
    } catch (error) {
      this.log(`Error extracting form data: ${error}`)
    }

    return result
  }

  /**
   * Extract historical matches from Enetpulse H2H widget
   */
  private async extractMatches(page: Page): Promise<any[]> {
    try {
      const matches: any[] = []

      // Find match event wrappers in the H2H widget
      const eventWrappers = await page
        .locator('.wff_h2h_event_wrapper, .wff_h2h_generic [class*="event"]')
        .all()

      for (const wrapper of eventWrappers) {
        try {
          // Extract date
          const dateEl = await wrapper
            .locator('[class*="date"], [class*="time"]')
            .first()
            .textContent()

          // Extract team names
          const teamEls = await wrapper
            .locator('[class*="participant"], [class*="team"]')
            .allTextContents()

          // Extract score
          const scoreEl = await wrapper
            .locator('[class*="score"], [class*="result"]')
            .first()
            .textContent()

          // Extract competition/league
          const competitionEl = await wrapper
            .locator('[class*="competition"], [class*="league"]')
            .first()
            .textContent()

          if (teamEls.length >= 2 || scoreEl) {
            matches.push({
              date: dateEl?.trim() || '',
              homeTeam: teamEls[0]?.trim() || '',
              awayTeam: teamEls[1]?.trim() || '',
              score: scoreEl?.trim() || '',
              competition: competitionEl?.trim() || undefined,
            })
          }
        } catch {
          // Continue to next event
        }
      }

      // If no events found via wrapper, try alternative structure
      if (matches.length === 0) {
        // Try to find match rows in a table structure
        const rows = await page
          .locator('.wff_h2h_generic table tr, .wff_h2h_generic [role="row"]')
          .all()

        for (const row of rows) {
          const cells = await row.locator('td, [role="cell"]').allTextContents()

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
      }

      this.log(`Found ${matches.length} historical matches`)
      return matches
    } catch (error) {
      this.log(`Error extracting matches: ${error}`)
      return []
    }
  }

  /**
   * Calculate summary statistics from extracted matches
   * Fallback when we can't extract from the header
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
