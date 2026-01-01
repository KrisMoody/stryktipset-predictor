import type { Page } from 'playwright'
import { BaseScraper } from './base-scraper'

/**
 * Player in the lineup
 */
export interface LineupPlayer {
  name: string
  number: number
  position?: string // e.g., "goalkeeper", "defender", "midfielder", "forward"
  gridRow?: number
  gridColumn?: number
}

/**
 * Unavailable player with reason
 */
export interface UnavailablePlayer {
  name: string
  number: number
  reason?: 'injured' | 'suspended' | 'unknown'
}

/**
 * Team lineup data
 */
export interface TeamLineup {
  teamName: string
  formation?: string // e.g., "5-3-2", "4-3-3"
  isConfirmed: boolean // false = "Trolig laguppställning"
  startingXI: LineupPlayer[]
  unavailable: UnavailablePlayer[]
  coach?: string
}

/**
 * Complete lineup data for both teams
 */
export interface LineupData {
  homeTeam: TeamLineup
  awayTeam: TeamLineup
  selectedTeam: 'home' | 'away'
}

/**
 * Scraper for the Laguppställning (Lineup) tab
 * Extracts team formations from the Enetpulse widget
 *
 * HTML Structure (Enetpulse formation widget):
 * - #enetpulse-container - Widget container
 * - .wff_formation_generic_root - Main formation widget
 * - .wff_team_tabs_container - Team selector tabs
 * - .wff_team_tab / .wff_team_tab.wff_not_selected - Tab states
 * - .wff_participant_name - Team name in tab
 * - .wff_formation_lineup_confirmation_container - Lineup status
 * - .wff_lineup_confirmation_label - "Trolig laguppställning" or "Bekräftad"
 * - .wff_team_rating_formation - Team name and formation
 * - .wff_team_formation span - Formation string (e.g., "5-3-2")
 * - .wff_grid_wrapper - The pitch grid with players
 * - .wff_grid_participant - Player name on pitch
 * - .wff_participant_shirt_number - Jersey number
 * - .wff_formation_lineup_type_container - Sections for unavailable/coach
 * - .wff_lineup_unavailable - Unavailable players section
 * - .wff_lineup_coach - Coach section
 * - .icon-injured - Injury indicator
 */
export class LineupScraper extends BaseScraper {
  /**
   * DOM-based scraping method
   * Supports all game types: stryktipset, europatipset, topptipset
   */
  async scrape(
    page: Page,
    _matchId: number,
    drawNumber: number,
    matchNumber: number,
    drawDate?: Date
  ): Promise<LineupData | null> {
    try {
      this.log(`Starting lineup scraping for ${this.gameType}`)

      // Determine if this is a current or historic draw
      const isCurrent = !drawDate || this.isCurrentDraw(drawDate)

      // Build URL using URL Manager (correct domain and pattern for all game types)
      const url = this.buildUrl('lineup', {
        matchNumber,
        drawNumber,
        drawDate: drawDate || new Date(),
        isCurrent,
      })
      this.log(`Navigating to: ${url}`)
      await this.navigateTo(page, url)

      // Wait for the Enetpulse formation widget to load
      await page.waitForSelector(
        '#enetpulse-container .wff_formation_generic_root, .wff_formation_generic',
        { timeout: 15000 }
      )

      // Give the widget extra time to fully render
      await this.humanDelay(1500, 2500)

      // Get team names from tabs
      const teamNames = await this.getTeamNames(page)

      // Extract currently displayed team's lineup (first tab is home team)
      const homeTeam = await this.extractTeamLineup(page, teamNames[0] || 'Home')

      // Click on away team tab and extract their lineup
      const awayTabSelector = '.wff_team_tab.wff_not_selected'
      let awayTeam: TeamLineup

      if (await this.elementExists(page, awayTabSelector)) {
        await page.locator(awayTabSelector).click()
        await this.humanDelay(500, 1000) // Wait for content to update
        awayTeam = await this.extractTeamLineup(page, teamNames[1] || 'Away')
      } else {
        // Away team tab might already be selected or not exist
        awayTeam = {
          teamName: teamNames[1] || 'Away',
          isConfirmed: false,
          startingXI: [],
          unavailable: [],
        }
      }

      // Determine which team is currently selected
      const selectedTeam = await this.getSelectedTeam(page, teamNames)

      const lineupData: LineupData = {
        homeTeam,
        awayTeam,
        selectedTeam,
      }

      this.log(
        `Lineup scraping complete: ${homeTeam.teamName} (${homeTeam.formation}), ${awayTeam.teamName} (${awayTeam.formation})`
      )
      return lineupData
    } catch (error) {
      this.log(`Error scraping lineup: ${error}`)
      return null
    }
  }

  /**
   * Get team names from the tab selector
   */
  private async getTeamNames(page: Page): Promise<string[]> {
    try {
      const tabs = await page
        .locator('.wff_team_tabs_container .wff_team_tab .wff_participant_name')
        .allTextContents()
      return tabs.map(name => name.trim())
    } catch {
      return []
    }
  }

  /**
   * Get which team is currently selected
   */
  private async getSelectedTeam(page: Page, teamNames: string[]): Promise<'home' | 'away'> {
    try {
      // The selected tab does NOT have .wff_not_selected class
      const selectedTab = await page
        .locator(
          '.wff_team_tabs_container .wff_team_tab:not(.wff_not_selected) .wff_participant_name'
        )
        .textContent()
      if (selectedTab && teamNames[1] && selectedTab.trim() === teamNames[1].trim()) {
        return 'away'
      }
      return 'home'
    } catch {
      return 'home'
    }
  }

  /**
   * Extract lineup data for the currently displayed team
   */
  private async extractTeamLineup(page: Page, teamName: string): Promise<TeamLineup> {
    const lineup: TeamLineup = {
      teamName,
      isConfirmed: false,
      startingXI: [],
      unavailable: [],
    }

    try {
      // Check if lineup is confirmed or probable
      const confirmationLabel = await page.locator('.wff_lineup_confirmation_label').textContent()
      lineup.isConfirmed = confirmationLabel?.toLowerCase().includes('bekräftad') || false

      // Get formation from .wff_team_formation span
      const formationText = await page.locator('.wff_team_formation span').textContent()
      if (formationText) {
        lineup.formation = formationText.trim()
      }

      // Extract starting XI from the pitch grid
      lineup.startingXI = await this.extractStartingXI(page)

      // Extract unavailable players
      lineup.unavailable = await this.extractUnavailablePlayers(page)

      // Extract coach
      const coachName = await page
        .locator('.wff_lineup_coach .wff_formation_lineup_type_participant_name')
        .textContent()
      if (coachName) {
        lineup.coach = coachName.trim()
      }
    } catch (error) {
      this.log(`Error extracting team lineup: ${error}`)
    }

    return lineup
  }

  /**
   * Extract starting XI players from the pitch grid
   */
  private async extractStartingXI(page: Page): Promise<LineupPlayer[]> {
    const players: LineupPlayer[] = []

    try {
      // Find all player containers on the pitch
      const playerContainers = await page.locator('.wff_stats_ball_container_wrapper').all()

      for (const container of playerContainers) {
        try {
          // Get player name
          const nameElement = container.locator('.wff_grid_participant')
          const name = await nameElement.textContent()

          // Get jersey number
          const numberElement = container.locator('.wff_participant_shirt_number')
          const numberText = await numberElement.textContent()
          const number = parseInt(numberText?.trim() || '0') || 0

          // Check if goalkeeper (has .wff_goalkeeper class)
          const isGoalkeeper = await nameElement
            .evaluate((el: Element) => el.classList.contains('wff_goalkeeper'))
            .catch(() => false)

          if (name) {
            players.push({
              name: name.trim(),
              number,
              position: isGoalkeeper ? 'goalkeeper' : undefined,
            })
          }
        } catch (innerError) {
          this.log(`Error extracting single player: ${innerError}`)
        }
      }

      this.log(`Extracted ${players.length} starting XI players`)
    } catch (error) {
      this.log(`Error extracting starting XI: ${error}`)
    }

    return players
  }

  /**
   * Extract unavailable players (injured, suspended, etc.)
   */
  private async extractUnavailablePlayers(page: Page): Promise<UnavailablePlayer[]> {
    const players: UnavailablePlayer[] = []

    try {
      // Find unavailable players section
      const unavailableSection = page.locator('.wff_lineup_unavailable')

      if ((await unavailableSection.count()) > 0) {
        const playerElements = await unavailableSection
          .locator('.wff_formation_lineup_type_participant')
          .all()

        for (const element of playerElements) {
          try {
            // Get player name
            const name = await element
              .locator('.wff_formation_lineup_type_participant_name')
              .textContent()

            // Get jersey number
            const numberText = await element.locator('.wff_participant_shirt_number').textContent()
            const number = parseInt(numberText?.trim() || '0') || 0

            // Check reason (injured indicator)
            const hasInjuredIcon = (await element.locator('.icon-injured').count()) > 0
            const reason = hasInjuredIcon ? 'injured' : 'unknown'

            if (name) {
              players.push({
                name: name.trim(),
                number,
                reason,
              })
            }
          } catch (innerError) {
            this.log(`Error extracting unavailable player: ${innerError}`)
          }
        }
      }

      this.log(`Extracted ${players.length} unavailable players`)
    } catch (error) {
      this.log(`Error extracting unavailable players: ${error}`)
    }

    return players
  }
}
