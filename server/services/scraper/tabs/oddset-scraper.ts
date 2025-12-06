import type { Page } from 'playwright'
import { BaseScraper } from './base-scraper'

/**
 * Single betting outcome (e.g., "1" at odds 4.20)
 */
export interface BetOutcome {
  label: string // e.g., "1", "X", "2", "Över 2.5", "Ja"
  odds: number // e.g., 4.20
}

/**
 * Betting market section (e.g., "Fulltid", "Totala mål")
 */
export interface BetMarket {
  name: string // e.g., "Fulltid", "Totala mål", "Halvtid", "Båda lagen gör mål"
  outcomes: BetOutcome[]
}

/**
 * Complete Oddset data from quick bets section
 */
export interface OddsetData {
  markets: BetMarket[]
  matchTitle?: string
}

/**
 * Scraper for the Oddset (Quick Bets) section
 * Extracts live odds from Svenska Spel's Oddset widget
 *
 * HTML Structure:
 * - .quick-bets - Main container
 * - .quick-bet-section - Each betting market section
 * - .quick-bet-section__header - Market name (e.g., "Fulltid", "Totala mål")
 * - .quick-bet-section-offer - Row with outcome buttons
 * - .outcome-btn - Individual bet button
 * - .btn-link-text - Contains "Label\nOdds" (e.g., "1\n4,20")
 */
export class OddsetScraper extends BaseScraper {
  /**
   * DOM-based scraping method
   */
  async scrape(page: Page, _matchId: number, drawNumber: number, matchNumber: number): Promise<OddsetData | null> {
    try {
      this.log('Starting Oddset scraping')

      // Navigate to match page (Oddset is typically on the main match info page)
      const url = `https://www.svenskaspel.se/stryktipset/${drawNumber}/${matchNumber}`
      await this.navigateTo(page, url)

      // Wait for the quick bets section to load
      await page.waitForSelector('.quick-bets, .quick-bet-section', { timeout: 15000 })

      // Give extra time for odds to render
      await this.humanDelay(1000, 2000)

      // Extract match title if available
      const matchTitle = await this.extractMatchTitle(page)

      // Extract all betting markets
      const markets = await this.extractMarkets(page)

      const oddsetData: OddsetData = {
        markets,
        matchTitle,
      }

      this.log(`Oddset scraping complete: ${markets.length} markets extracted`)
      return oddsetData
    }
    catch (error) {
      this.log(`Error scraping Oddset: ${error}`)
      return null
    }
  }

  /**
   * Extract match title from the page
   */
  private async extractMatchTitle(page: Page): Promise<string | undefined> {
    try {
      // Try common match title selectors
      const titleSelectors = [
        '.match-header__title',
        '.event-header__title',
        '.match-info-header h1',
        '.match-title',
      ]

      for (const selector of titleSelectors) {
        const title = await page.locator(selector).first().textContent()
        if (title?.trim()) {
          return title.trim()
        }
      }
    }
    catch {
      // Title not found is acceptable
    }
    return undefined
  }

  /**
   * Extract all betting markets from quick bets section
   */
  private async extractMarkets(page: Page): Promise<BetMarket[]> {
    const markets: BetMarket[] = []

    try {
      // Find all bet sections
      const sections = await page.locator('.quick-bet-section').all()

      for (const section of sections) {
        try {
          // Get market name from header
          const headerElement = section.locator('.quick-bet-section__header')
          const marketName = await headerElement.textContent()

          if (!marketName?.trim()) continue

          // Extract outcomes from this section
          const outcomes = await this.extractOutcomes(section)

          if (outcomes.length > 0) {
            markets.push({
              name: marketName.trim(),
              outcomes,
            })
          }
        }
        catch (innerError) {
          this.log(`Error extracting single market: ${innerError}`)
        }
      }

      this.log(`Extracted ${markets.length} betting markets`)
    }
    catch (error) {
      this.log(`Error extracting markets: ${error}`)
    }

    return markets
  }

  /**
   * Extract outcomes from a market section
   */
  private async extractOutcomes(section: any): Promise<BetOutcome[]> {
    const outcomes: BetOutcome[] = []

    try {
      // Find all outcome buttons in this section
      const buttons = await section.locator('.outcome-btn').all()

      for (const button of buttons) {
        try {
          // Get the button text which contains "Label\nOdds"
          const buttonText = await button.locator('.btn-link-text').textContent()

          if (!buttonText) continue

          // Parse label and odds from the button text
          // Format is "Label\nOdds" (e.g., "1\n4,20" or "Över 2.5\n1,79")
          const parts = buttonText.trim().split('\n')

          if (parts.length >= 2) {
            const label = parts[0].trim()
            const oddsText = parts[1].trim()

            // Parse odds (Swedish format uses comma as decimal separator)
            const odds = this.parseOdds(oddsText)

            if (label && odds > 0) {
              outcomes.push({ label, odds })
            }
          }
        }
        catch (innerError) {
          this.log(`Error extracting single outcome: ${innerError}`)
        }
      }
    }
    catch (error) {
      this.log(`Error extracting outcomes: ${error}`)
    }

    return outcomes
  }

  /**
   * Parse Swedish odds format (e.g., "4,20") to number
   */
  private parseOdds(oddsText: string): number {
    try {
      // Replace comma with dot for parsing
      const normalized = oddsText.replace(',', '.')
      const odds = parseFloat(normalized)
      return isNaN(odds) ? 0 : odds
    }
    catch {
      return 0
    }
  }
}
