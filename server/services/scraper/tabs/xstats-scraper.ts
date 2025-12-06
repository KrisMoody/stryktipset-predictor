import type { Page } from 'playwright'
import { BaseScraper } from './base-scraper'
import type { XStatsData, XStatsValues } from '~/types'

/**
 * Spider chart statistics (from playmaker widget)
 */
export interface SpiderChartStats {
  setPlays: number // Fasta situationer (Offensiva)
  chancesFor: number // Chanser för
  counters: number // Kontringar
  setPlaysDefensive: number // Fasta situationer (Defensiva)
  chancesAgainst: number // Chanser emot
  possession: number // Bollinnehav
}

/**
 * Goal stats for a single team
 */
export interface TeamGoalStats {
  xg?: string // Förväntade mål (xG)
  xgc?: string // Förväntade insläppta mål (xGC)
  avgGoalsScored?: string // Genomsnitt gjorda mål
  avgGoalsConceded?: string // Genomsnitt insläppta mål
  avgGoalsH2H?: string // Genomsnitt gjorda mål inbördes
  avgGoalsHomeAway?: string // Genomsnitt gjorda mål hemma & borta
}

/**
 * Expected points for a single team
 */
export interface TeamExpectedPoints {
  xp?: string // Förväntade poäng (xP)
  points?: string // Poäng
  xpDiff?: string // Skillnad i xP/poäng
  expectedPosition?: string // Förväntad tabellplacering
  position?: string // Tabellplacering
}

/**
 * Extended xStats data with all playmaker widget data
 */
export interface ExtendedXStatsData extends XStatsData {
  // Team names from the widget
  homeTeamName?: string
  awayTeamName?: string
  // Selected period from dropdown
  selectedPeriod?: string
  // Spider chart data per team
  spiderChart?: {
    home?: SpiderChartStats
    away?: SpiderChartStats
  }
  // Goal statistics (xG widget)
  goalStats?: {
    home: TeamGoalStats
    away: TeamGoalStats
  }
  // Expected points (xP widget)
  expectedPoints?: {
    home: TeamExpectedPoints
    away: TeamExpectedPoints
  }
}

/**
 * Scraper for xStats tab (expected goals, expected points, spider chart)
 * URL: /stryktipset/xstats?event={matchNumber} (current draws)
 *
 * The xStats page uses Playmaker widgets with this structure:
 * - .playmaker_widget_xstat - Main container
 * - .playmaker_widget_xstat__drop_down - Period selector dropdown
 * - .playmaker_widget_xstat__spider_widget - Spider/radar chart
 * - .playmaker_widget_xstat__expected_points_widget - xP table
 * - .playmaker_widget_xstat__goal_stat_widget - xG table
 *
 * Tables use role="table" with:
 * - .pm-x-row-team-name - Team names (home/away)
 * - .pm-x-metric-row - Data rows
 * - .pm-x-metric-name - Metric label (center)
 * - .pm-x-row-metric-value - Values (home on left, away on right)
 */
export class XStatsScraper extends BaseScraper {
  /**
   * DOM-based scraping method
   */
  async scrape(
    page: Page,
    _matchId: number,
    drawNumber: number,
    matchNumber: number
  ): Promise<ExtendedXStatsData | null> {
    try {
      this.log('Starting xStats scraping')

      // Navigate to match page first
      const url = `https://www.svenskaspel.se/stryktipset/${drawNumber}/${matchNumber}`
      await this.navigateTo(page, url)

      // Click on xStats tab - use the data-test-id attribute
      const xStatsTabSelector =
        '[data-test-id="statistic-menu-xstat"], a[href*="/xstats"], a:has-text("xStats")'
      if (await this.elementExists(page, xStatsTabSelector)) {
        await this.clickTab(page, xStatsTabSelector)
      } else {
        this.log('xStats tab not found, trying direct navigation')
        await this.navigateTo(
          page,
          `https://www.svenskaspel.se/stryktipset/xstats?event=${matchNumber}`
        )
      }

      // Wait for playmaker widget to load
      await page.waitForSelector('.playmaker_widget_xstat, .pm-x-container', { timeout: 10000 })

      // Extract team names
      const teamNames = await this.extractTeamNames(page)

      // Extract selected period from dropdown
      const selectedPeriod = await this.extractSelectedPeriod(page)

      // Extract goal statistics (xG)
      const goalStats = await this.extractGoalStats(page)

      // Extract expected points (xP)
      const expectedPoints = await this.extractExpectedPoints(page)

      // Build the XStatsData structure for compatibility
      const xStatsData: ExtendedXStatsData = {
        homeTeam: this.buildTeamXStats(goalStats?.home, expectedPoints?.home, 'home'),
        awayTeam: this.buildTeamXStats(goalStats?.away, expectedPoints?.away, 'away'),
        homeTeamName: teamNames.home,
        awayTeamName: teamNames.away,
        selectedPeriod,
        goalStats,
        expectedPoints,
      }

      this.log('xStats scraping complete')
      return xStatsData
    } catch (error) {
      this.log(`Error scraping xStats: ${error}`)
      return null
    }
  }

  /**
   * Extract team names from the widget headers
   */
  private async extractTeamNames(page: Page): Promise<{ home?: string; away?: string }> {
    try {
      // Team names appear in .pm-x-row-team-name or .pm-spider-home-team/.pm-spider-away-team
      const homeTeam = await page
        .locator('.pm-spider-home-team, .pm-x-row-home.pm-x-row-team-name')
        .first()
        .textContent()
      const awayTeam = await page
        .locator('.pm-spider-away-team, .pm-x-row-away.pm-x-row-team-name')
        .first()
        .textContent()

      return {
        home: homeTeam?.trim(),
        away: awayTeam?.trim(),
      }
    } catch (error) {
      this.log(`Error extracting team names: ${error}`)
      return {}
    }
  }

  /**
   * Extract the currently selected period from the dropdown
   */
  private async extractSelectedPeriod(page: Page): Promise<string | undefined> {
    try {
      // The dropdown is a <select> element with options
      const selectElement = page.locator('.playmaker_widget_xstat__drop_down select')
      if ((await selectElement.count()) > 0) {
        const selectedValue = await selectElement.inputValue()
        // Also get the display text
        const selectedOption = await selectElement
          .locator(`option[value="${selectedValue}"]`)
          .textContent()
        return selectedOption?.trim() || selectedValue
      }
    } catch (error) {
      this.log(`Error extracting selected period: ${error}`)
    }
    return undefined
  }

  /**
   * Extract goal statistics from the xG widget
   * Widget: .playmaker_widget_xstat__goal_stat_widget
   * Table structure: [Home Value] [Metric Name] [Away Value]
   */
  private async extractGoalStats(
    page: Page
  ): Promise<{ home: TeamGoalStats; away: TeamGoalStats } | undefined> {
    try {
      const widget = page.locator('.playmaker_widget_xstat__goal_stat_widget .pm-x-container')
      if ((await widget.count()) === 0) {
        this.log('Goal stats widget not found')
        return undefined
      }

      const home: TeamGoalStats = {}
      const away: TeamGoalStats = {}

      // Get all metric rows
      const rows = await widget.locator('.pm-x-metric-row').all()

      for (const row of rows) {
        const metricName = await row.locator('.pm-x-metric-name').textContent()
        const homeValue = await row.locator('[role="cell"]:first-child').textContent()
        const awayValue = await row.locator('.pm-x-row-away').textContent()

        if (!metricName) continue

        const metric = metricName.toLowerCase().trim()
        const hVal = homeValue?.trim()
        const aVal = awayValue?.trim()

        if (
          metric.includes('förväntade mål') &&
          metric.includes('xg') &&
          !metric.includes('insläppta')
        ) {
          home.xg = hVal
          away.xg = aVal
        } else if (metric.includes('insläppta') && metric.includes('xgc')) {
          home.xgc = hVal
          away.xgc = aVal
        } else if (metric.includes('genomsnitt gjorda mål') && metric.includes('hela säsongen')) {
          home.avgGoalsScored = hVal
          away.avgGoalsScored = aVal
        } else if (metric.includes('genomsnitt insläppta mål')) {
          home.avgGoalsConceded = hVal
          away.avgGoalsConceded = aVal
        } else if (metric.includes('inbördes')) {
          home.avgGoalsH2H = hVal
          away.avgGoalsH2H = aVal
        } else if (metric.includes('hemma') && metric.includes('borta')) {
          home.avgGoalsHomeAway = hVal
          away.avgGoalsHomeAway = aVal
        }
      }

      return { home, away }
    } catch (error) {
      this.log(`Error extracting goal stats: ${error}`)
      return undefined
    }
  }

  /**
   * Extract expected points from the xP widget
   * Widget: .playmaker_widget_xstat__expected_points_widget
   */
  private async extractExpectedPoints(
    page: Page
  ): Promise<{ home: TeamExpectedPoints; away: TeamExpectedPoints } | undefined> {
    try {
      const widget = page.locator('.playmaker_widget_xstat__expected_points_widget .pm-x-container')
      if ((await widget.count()) === 0) {
        this.log('Expected points widget not found')
        return undefined
      }

      const home: TeamExpectedPoints = {}
      const away: TeamExpectedPoints = {}

      // Get all metric rows
      const rows = await widget.locator('.pm-x-metric-row').all()

      for (const row of rows) {
        const metricName = await row.locator('.pm-x-metric-name').textContent()
        const homeValue = await row.locator('[role="cell"]:first-child').textContent()
        const awayValue = await row.locator('.pm-x-row-away').textContent()

        if (!metricName) continue

        const metric = metricName.toLowerCase().trim()
        const hVal = homeValue?.trim()
        const aVal = awayValue?.trim()

        if (metric.includes('förväntade poäng') && metric.includes('xp')) {
          home.xp = hVal
          away.xp = aVal
        } else if (metric === 'poäng') {
          home.points = hVal
          away.points = aVal
        } else if (metric.includes('skillnad')) {
          home.xpDiff = hVal
          away.xpDiff = aVal
        } else if (metric.includes('förväntad tabellplacering')) {
          home.expectedPosition = hVal
          away.expectedPosition = aVal
        } else if (metric === 'tabellplacering') {
          home.position = hVal
          away.position = aVal
        }
      }

      return { home, away }
    } catch (error) {
      this.log(`Error extracting expected points: ${error}`)
      return undefined
    }
  }

  /**
   * Build XStatsData team structure from extracted data
   * This maintains compatibility with the existing XStatsData type
   */
  private buildTeamXStats(
    goalStats: TeamGoalStats | undefined,
    expectedPoints: TeamExpectedPoints | undefined,
    _side: 'home' | 'away'
  ): XStatsData['homeTeam'] {
    const values: XStatsValues = {}

    if (goalStats?.xg) values.xg = goalStats.xg
    if (goalStats?.xgc) values.xga = goalStats.xgc
    if (expectedPoints?.xp) values.xp = expectedPoints.xp

    // Calculate xGD if we have both xG and xGA
    if (values.xg && values.xga) {
      const xg = this.parseNumericValue(values.xg)
      const xga = this.parseNumericValue(values.xga)
      if (xg !== undefined && xga !== undefined) {
        values.xgd = (xg - xga).toFixed(2)
      }
    }

    return {
      entireSeason: values,
    }
  }

  /**
   * Parse a numeric value from string
   */
  private parseNumericValue(value: string): number | undefined {
    if (!value) return undefined
    const cleaned = value.replace(',', '.').replace(/[^\d.-]/g, '')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? undefined : parsed
  }
}
