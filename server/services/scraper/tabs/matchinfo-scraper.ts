import type { Page } from 'playwright'
import { BaseScraper } from './base-scraper'

/**
 * Betting odds from different sources
 */
export interface BettingOdds {
  source: string
  subSource?: string // e.g., "Svenska Folket"
  one: string // Home win
  x: string // Draw
  two: string // Away win
}

/**
 * Over/Under odds data
 */
export interface OverUnderOdds {
  threshold: string // e.g., "2,5"
  over: string
  under: string
}

/**
 * Favorites data based on odds
 */
export interface FavoritesData {
  homePercentage: number
  drawPercentage: number
  awayPercentage: number
}

/**
 * General match information
 */
export interface GeneralMatchInfo {
  date?: string
  time?: string
  league?: string
  venue?: string
}

/**
 * Complete match info data from the Matchinfo page
 */
export interface MatchInfoData {
  bettingOdds: BettingOdds[]
  overUnderOdds?: OverUnderOdds
  favorites?: FavoritesData
  generalInfo?: GeneralMatchInfo
}

/**
 * Scraper for the main Matchinfo page
 * Extracts: Spelstatistik (odds, betting percentages), Over/Under, Favorites, General Info
 *
 * HTML Structure from Svenska Spel:
 * - .match_info_table.match-info-product-odds - Main betting odds table
 * - .match_info_table.match-info-over-under-odds - Over/Under table
 * - .match-info-favorites - Favorites bar
 * - .general-match-info-table - Date, time, venue
 */
export class MatchInfoScraper extends BaseScraper {
  /**
   * DOM-based scraping method
   */
  async scrape(
    page: Page,
    _matchId: number,
    drawNumber: number,
    matchNumber: number
  ): Promise<MatchInfoData | null> {
    try {
      this.log('Starting matchinfo scraping')

      // Navigate to match page (Matchinfo is the default view)
      const url = `https://www.svenskaspel.se/stryktipset/${drawNumber}/${matchNumber}`
      await this.navigateTo(page, url)

      // Wait for the statistics section to load
      await page.waitForSelector('.statistics-match-info, .statistics-section', { timeout: 10000 })

      // Extract all data
      const bettingOdds = await this.extractBettingOdds(page)
      const overUnderOdds = await this.extractOverUnderOdds(page)
      const favorites = await this.extractFavorites(page)
      const generalInfo = await this.extractGeneralInfo(page)

      const matchInfoData: MatchInfoData = {
        bettingOdds,
        overUnderOdds,
        favorites,
        generalInfo,
      }

      this.log(`Matchinfo scraping complete: ${bettingOdds.length} odds sources`)
      return matchInfoData
    } catch (error) {
      this.log(`Error scraping matchinfo: ${error}`)
      return null
    }
  }

  /**
   * Extract betting odds from the Spelstatistik table
   * Table structure: .match_info_table.match-info-product-odds
   * Rows contain: source name, 1, X, 2 values
   */
  private async extractBettingOdds(page: Page): Promise<BettingOdds[]> {
    const odds: BettingOdds[] = []

    try {
      // Find all rows in the product odds table
      const rows = await page
        .locator('.match-info-product-odds .match_info_table-body .match_info_table-row')
        .all()

      for (const row of rows) {
        try {
          // Extract source name from .product-odds-rowheading
          const sourceElement = await row.locator('.product-odds-rowheading').first()
          const source = await sourceElement.textContent()

          // Extract sub-source if present (e.g., "Svenska Folket")
          const subSourceElement = await row.locator('.product-odds-sub-rowheading')
          const subSourceCount = await subSourceElement.count()
          const subSource = subSourceCount > 0 ? await subSourceElement.textContent() : null

          // Extract the three values (1, X, 2) from content cells
          const cells = await row.locator('.match_info_table-content-cell').allTextContents()

          if (source && cells.length >= 3) {
            odds.push({
              source: source.trim(),
              subSource: subSource?.trim() || undefined,
              one: cells[0]?.trim() || '',
              x: cells[1]?.trim() || '',
              two: cells[2]?.trim() || '',
            })
          }
        } catch (innerError) {
          this.log(`Error extracting single odds row: ${innerError}`)
        }
      }

      this.log(`Extracted ${odds.length} betting odds entries`)
    } catch (error) {
      this.log(`Error extracting betting odds: ${error}`)
    }

    return odds
  }

  /**
   * Extract Over/Under odds from the table
   * Table structure: .match_info_table.match-info-over-under-odds
   */
  private async extractOverUnderOdds(page: Page): Promise<OverUnderOdds | undefined> {
    try {
      const overUnderTable = page.locator('.match-info-over-under-odds')
      const tableExists = (await overUnderTable.count()) > 0

      if (!tableExists) {
        this.log('Over/Under table not found')
        return undefined
      }

      // Extract threshold from the row heading (e.g., "Över/Under 2,5 mål")
      const thresholdText = await overUnderTable.locator('.product-odds-rowheading').textContent()
      let threshold = '2,5' // default

      if (thresholdText) {
        const match = thresholdText.match(/(\d+[,.]?\d*)\s*mål/i)
        if (match) {
          threshold = match[1] || '2,5'
        }
      }

      // Extract Over and Under values from content cells
      const cells = await overUnderTable
        .locator('.match_info_table-body .match_info_table-content-cell')
        .allTextContents()

      if (cells.length >= 2) {
        return {
          threshold,
          over: cells[0]?.trim() || '',
          under: cells[1]?.trim() || '',
        }
      }
    } catch (error) {
      this.log(`Error extracting over/under odds: ${error}`)
    }

    return undefined
  }

  /**
   * Extract favorites data from the favorites bar
   * Structure: .match-info-favorites with percentage bars
   */
  private async extractFavorites(page: Page): Promise<FavoritesData | undefined> {
    try {
      const favoritesTable = page.locator('.match-info-favorites')
      const tableExists = (await favoritesTable.count()) > 0

      if (!tableExists) {
        this.log('Favorites section not found')
        return undefined
      }

      // The favorites are shown as percentage bars
      // grid-template-columns style shows the ratio (e.g., "24fr 25fr 52fr")
      const barsRow = await favoritesTable.locator('tr').first()
      const bars = await barsRow.locator('.match-info-favorites-bar').allTextContents()

      if (bars.length >= 3) {
        return {
          homePercentage: this.parsePercentage(bars[0] || ''),
          drawPercentage: this.parsePercentage(bars[1] || ''),
          awayPercentage: this.parsePercentage(bars[2] || ''),
        }
      }
    } catch (error) {
      this.log(`Error extracting favorites: ${error}`)
    }

    return undefined
  }

  /**
   * Extract general match information
   * Structure: .general-match-info-table with rows for date, time, league, venue
   */
  private async extractGeneralInfo(page: Page): Promise<GeneralMatchInfo | undefined> {
    try {
      const infoTable = page.locator('.general-match-info-table')
      const tableExists = (await infoTable.count()) > 0

      if (!tableExists) {
        this.log('General info table not found')
        return undefined
      }

      const info: GeneralMatchInfo = {}

      // Extract each row
      const rows = await infoTable.locator('.general-match-info-table-row').all()

      for (const row of rows) {
        const label = await row.locator('.general-match-info-table-row-label').textContent()
        const content = await row.locator('.general-match-info-table-row-content').textContent()

        if (!label) continue

        const labelLower = label.toLowerCase().trim()

        if (labelLower.includes('datum') || labelLower.includes('date')) {
          info.date = content?.trim() || undefined
        } else if (labelLower.includes('tid') || labelLower.includes('time')) {
          info.time = content?.trim() || undefined
        } else if (
          labelLower.includes('plats') ||
          labelLower.includes('arena') ||
          labelLower.includes('venue')
        ) {
          // Venue is sometimes just in the label cell without a content cell
          info.venue = content?.trim() || label.trim()
        } else if (!info.league && !content) {
          // League name often appears as just a label without content
          info.league = label.trim()
        }
      }

      // If venue wasn't found, check for standalone venue row
      if (!info.venue) {
        const venueRow = await infoTable
          .locator('.general-match-info-table-row:last-child .general-match-info-table-row-label')
          .textContent()
        if (
          venueRow &&
          !venueRow.toLowerCase().includes('datum') &&
          !venueRow.toLowerCase().includes('tid')
        ) {
          info.venue = venueRow.trim()
        }
      }

      return info
    } catch (error) {
      this.log(`Error extracting general info: ${error}`)
    }

    return undefined
  }

  /**
   * Parse percentage string to number
   * Handles formats like "22%", "22", "22.5%"
   */
  private parsePercentage(value: string): number {
    const cleaned = value.replace('%', '').replace(',', '.').trim()
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }
}
