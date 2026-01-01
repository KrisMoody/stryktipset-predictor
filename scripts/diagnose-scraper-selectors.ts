/**
 * Diagnostic script to test scraper selectors against live Svenska Spel pages
 *
 * Run with: npx tsx scripts/diagnose-scraper-selectors.ts
 *
 * This script navigates to actual pages and reports which CSS selectors are found/missing.
 */

import { chromium, type Page, type Browser } from 'playwright'

interface SelectorTest {
  name: string
  selector: string
  found: boolean
  count: number
  sampleText?: string
}

interface PageReport {
  url: string
  status: 'success' | 'failed' | 'timeout'
  error?: string
  selectors: SelectorTest[]
}

// Color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
}

// Selectors to test per page type - comprehensive list matching actual scraper code
const SELECTORS_BY_PAGE = {
  matchPage: [
    // Main sections
    { name: 'Match info section', selector: '.statistics-match-info, .statistics-section' },
    { name: 'Betting odds table', selector: '.match-info-product-odds' },
    { name: 'Over/Under table', selector: '.match-info-over-under-odds' },
    { name: 'Favorites section', selector: '.match-info-favorites' },
    { name: 'General info table', selector: '.general-match-info-table' },
    // Odds details
    { name: 'Odds header cells', selector: '.match-info-product-odds th' },
    { name: 'Odds data rows', selector: '.match-info-product-odds tr' },
    { name: 'Over/Under data', selector: '.match-info-over-under-odds tr' },
    // General match info structure (discovered)
    { name: 'General info row', selector: '.general-match-info-table-row' },
    { name: 'General info label', selector: '.general-match-info-table-row-label' },
    { name: 'General info content', selector: '.general-match-info-table-row-content' },
    // Betting buttons (discovered - NOT quick-bets!)
    { name: 'Bet buttons (any)', selector: '.btn-bet' },
    { name: 'Bet button 300', selector: '.btn-bet-300' },
    { name: 'Bet button label', selector: '.btn-bet-label' },
    { name: 'Selected bet button', selector: '.btn-bet-selected' },
    { name: 'Bet buttons container', selector: '.analysis-bet-buttons' },
    { name: 'Coupon bet buttons', selector: '.coupon-bet-buttons' },
    // Expert analysis on match page
    { name: 'Expert analysis container', selector: '.match-info-match-analysis' },
    { name: 'Expert author name', selector: '.analysis-author-name' },
    { name: 'Expert profile pic', selector: '.analysis-profile-picture' },
    { name: 'Expert analysis body', selector: '.analysis-body' },
    // Team info (discovered)
    { name: 'Home participant', selector: '.home-participant' },
    { name: 'Away participant', selector: '.away-participant' },
    { name: 'Participant', selector: '.participant' },
  ],
  xStats: [
    // Main containers
    { name: 'Playmaker widget', selector: '.playmaker_widget_xstat, .pm-x-container' },
    { name: 'Period dropdown', selector: '.playmaker_widget_xstat__drop_down' },
    { name: 'Period select element', selector: '.playmaker_widget_xstat__drop_down select' },
    // Team names
    { name: 'Home team (spider)', selector: '.pm-spider-home-team' },
    { name: 'Away team (spider)', selector: '.pm-spider-away-team' },
    { name: 'Home team (row)', selector: '.pm-x-row-home.pm-x-row-team-name' },
    { name: 'Away team (row)', selector: '.pm-x-row-away.pm-x-row-team-name' },
    // Spider chart
    { name: 'Spider chart widget', selector: '.playmaker_widget_xstat__spider_widget' },
    // Goal stats (xG)
    { name: 'Goal stats widget', selector: '.playmaker_widget_xstat__goal_stat_widget' },
    {
      name: 'Goal stats container',
      selector: '.playmaker_widget_xstat__goal_stat_widget .pm-x-container',
    },
    // Expected points (xP)
    { name: 'Expected points widget', selector: '.playmaker_widget_xstat__expected_points_widget' },
    {
      name: 'Expected points container',
      selector: '.playmaker_widget_xstat__expected_points_widget .pm-x-container',
    },
    // Data rows
    { name: 'Metric rows', selector: '.pm-x-metric-row' },
    { name: 'Metric name', selector: '.pm-x-metric-name' },
    { name: 'Metric value cells', selector: '[role="cell"]' },
    { name: 'Away value cells', selector: '.pm-x-row-away' },
  ],
  statistics: [
    // Main containers (discovered)
    { name: 'Tipsen container', selector: '#tipsen-container, #tipsen' },
    { name: 'Enetpulse container', selector: '#enetpulse-container' },
    { name: 'Any table', selector: 'table' },
    // Table structure
    { name: 'Table rows', selector: 'table tbody tr' },
    { name: 'Table cells', selector: 'td' },
    // Team name elements (discovered: home-participant, away-participant)
    { name: 'Home participant', selector: '.home-participant' },
    { name: 'Away participant', selector: '.away-participant' },
    { name: 'Participant', selector: '.participant' },
    { name: 'Participant split', selector: '.participant-split' },
    // Enetpulse team wrappers (discovered on statistik page)
    { name: 'Enetpulse home wrapper', selector: '.wff_event_home_participant_wrapper' },
    { name: 'Enetpulse away wrapper', selector: '.wff_event_away_participant_wrapper' },
    { name: 'Enetpulse home participants', selector: '.wff_event_home_participants' },
    { name: 'Enetpulse away participants', selector: '.wff_event_away_participants' },
    // Form indicators (Enetpulse style - discovered)
    { name: 'Form Win (V/W)', selector: '.wff_circle_value_w' },
    { name: 'Form Draw (O/D)', selector: '.wff_circle_value_d' },
    { name: 'Form Loss (F/L)', selector: '.wff_circle_value_l' },
  ],
  table: [
    // Main containers
    { name: 'Enetpulse container', selector: '#enetpulse-container' },
    { name: 'Standings root', selector: '.wff_standings_generic_root' },
    // Tab navigation
    { name: 'Standing type tabs', selector: '.wff_standing_type_tab' },
    // Table structure
    { name: 'Standings table rows', selector: '.wff_standings_table_row' },
    { name: 'Position column', selector: '.wff_standings_position' },
    { name: 'Team container', selector: '.wff_standings_team' },
    { name: 'Team name', selector: '.wff_participant_name' },
    { name: 'Stats box', selector: '.wff_standings_stats_box' },
    // Position markers
    { name: 'Position marker strip', selector: '.wff_standing_position_marker_strip' },
    { name: 'Highlighted row', selector: '.wff_highlight_event_selected_row' },
    // Stats columns (M, V, O, F, +/-, P)
    { name: 'Stats column headers', selector: '.wff_standings_stats_header' },
  ],
  lineup: [
    // Main containers
    { name: 'Enetpulse container', selector: '#enetpulse-container' },
    { name: 'Formation root', selector: '.wff_formation_generic_root, .wff_formation_generic' },
    // Team tabs
    { name: 'Team tabs container', selector: '.wff_team_tabs_container' },
    { name: 'Team tab', selector: '.wff_team_tab' },
    // Formation info
    { name: 'Lineup confirmation', selector: '.wff_lineup_confirmation_label' },
    { name: 'Team formation container', selector: '.wff_team_formation' },
    { name: 'Formation string', selector: '.wff_team_formation span' },
    // Player grid
    { name: 'Grid wrapper', selector: '.wff_grid_wrapper' },
    { name: 'Player containers', selector: '.wff_stats_ball_container_wrapper' },
    // Player details
    { name: 'Player name', selector: '.wff_grid_participant' },
    { name: 'Jersey number', selector: '.wff_participant_shirt_number' },
    { name: 'Stats ball', selector: '.wff_stats_ball_container' },
    // Substitutes & unavailable
    { name: 'Unavailable section', selector: '.wff_lineup_unavailable' },
    { name: 'Lineup type container', selector: '.wff_formation_lineup_type_container' },
    { name: 'Injury icon', selector: '.icon-injured' },
    // Coach
    { name: 'Coach section', selector: '.wff_lineup_coach' },
  ],
  headToHead: [
    // H2H is embedded in Statistik page via Enetpulse widget
    // Main container
    { name: 'H2H widget container', selector: '.wff_h2h_generic, .wff_h2h_generic_soccer' },
    { name: 'H2H any element', selector: '[class*="wff_h2h"]' },
    // Sections
    { name: 'H2H section header', selector: '.wff_h2h_section_header' },
    { name: 'H2H filter header', selector: '.wff_h2h_filter_header' },
    { name: 'Home section', selector: '.wff_h2h_generic_section_data.wff_home' },
    { name: 'Away section', selector: '.wff_h2h_generic_section_data.wff_away' },
    // Historical matches
    { name: 'H2H event wrapper', selector: '.wff_h2h_event_wrapper' },
    {
      name: 'H2H event date',
      selector: '.wff_h2h_event_wrapper [class*="date"], .wff_h2h_event_wrapper [class*="time"]',
    },
    {
      name: 'H2H team names',
      selector:
        '.wff_h2h_event_wrapper [class*="participant"], .wff_h2h_event_wrapper [class*="team"]',
    },
    {
      name: 'H2H score',
      selector: '.wff_h2h_event_wrapper [class*="score"], .wff_h2h_event_wrapper [class*="result"]',
    },
    {
      name: 'H2H competition',
      selector:
        '.wff_h2h_event_wrapper [class*="competition"], .wff_h2h_event_wrapper [class*="league"]',
    },
    // Form indicators
    { name: 'Form ball container', selector: '.wff_stats_ball_container' },
    { name: 'Form circle value', selector: '[class*="wff_circle_value"]' },
    { name: 'Win indicator', selector: '.wff_circle_value_w, [class*="win"]' },
    { name: 'Draw indicator', selector: '.wff_circle_value_d, [class*="draw"]' },
    { name: 'Loss indicator', selector: '.wff_circle_value_l, [class*="loss"]' },
  ],
  news: [
    // Confirmed HTML structure (from historic draws with news content):
    // Navigation
    {
      name: 'News tab link',
      selector: '[data-test-id="statistic-menu-tt-news"], a[href*="/nyheter"]',
    },
    // Main content containers
    { name: 'Side nav overflow', selector: '.tipsen-side-nav-overflow' },
    { name: 'Route play statistic', selector: '.route-play-statistic' },
    // Article containers (confirmed)
    { name: 'News article container', selector: '.route-statistics-news-article' },
    { name: 'News article (new design)', selector: '.route-statistics-news-article-new-design' },
    // Article content structure
    { name: 'Article headline (h2)', selector: 'h2.news-article-headline, .news-article-headline' },
    { name: 'Article header', selector: '.news-article-header' },
    { name: 'Article author', selector: '.news-article-header-author' },
    { name: 'Article published time', selector: '.news-article-header-published time' },
    { name: 'Article content', selector: '.f-content' },
    { name: 'Article paragraphs', selector: '.f-content p' },
    { name: 'Article blockquotes', selector: '.f-content blockquote' },
    // Generic fallbacks
    { name: 'Any article tag', selector: 'article' },
    { name: 'Time elements', selector: 'time' },
  ],
  analysis: [
    // Main container
    { name: 'Analysis container', selector: '.route-play-draw-analyses' },
    // Author section
    { name: 'Author container', selector: '.draw-analysis-author-container' },
    { name: 'Author name', selector: '.draw-analysis-name' },
    { name: 'Author wrapper', selector: '.draw-analysis-author' },
    { name: 'Author image', selector: '.draw-analysis-author img' },
    { name: 'Author presentation', selector: '.draw_analysis_author__presentation' },
    { name: 'Author presentation text', selector: '.draw_analysis_author__presentation span' },
    // Event analyses
    { name: 'Event analyses list', selector: '.event-analyses' },
    { name: 'Match prediction', selector: '.pg_analyse__event' },
    { name: 'Prediction title', selector: '.pg_analyse__event__title' },
    { name: 'Prediction info', selector: '.pg_analyse__event__info' },
    { name: 'Prediction text', selector: '.pg_analyse__event__info__prediction__title' },
    // Outcomes
    { name: 'Outcome container', selector: '.pg_outcome' },
    { name: 'Selected outcome', selector: '.pg_outcome--selected' },
    { name: 'Outcome sign', selector: '.pg_outcome__sign' },
    { name: 'Selected outcome sign', selector: '.pg_outcome--selected .pg_outcome__sign' },
  ],
}

// Game types to test
const GAME_TYPES = ['stryktipset', 'europatipset', 'topptipset'] as const
type GameType = (typeof GAME_TYPES)[number]

// Base URL
const BASE_URL = 'https://spela.svenskaspel.se'

async function testSelectors(
  page: Page,
  selectors: { name: string; selector: string }[]
): Promise<SelectorTest[]> {
  const results: SelectorTest[] = []

  for (const { name, selector } of selectors) {
    try {
      // Handle :has-text() pseudo-selector (Playwright-specific)
      if (selector.includes(':has-text(')) {
        const parts = selector.split(', ')
        let found = false
        let count = 0
        let sampleText = ''

        for (const part of parts) {
          if (part.includes(':has-text(')) {
            const match = part.match(/:has-text\("([^"]+)"\)/)
            if (match) {
              const text = match[1]
              const baseSelector = part.split(':has-text')[0] || '*'
              try {
                const elements = await page.locator(`${baseSelector}:has-text("${text}")`).all()
                const firstEl = elements[0]
                if (elements.length > 0 && firstEl) {
                  found = true
                  count = elements.length
                  sampleText = (await firstEl.textContent())?.trim().substring(0, 50) || ''
                  break
                }
              } catch {
                // Continue to next part
              }
            }
          } else {
            const elements = await page.locator(part).all()
            const firstEl = elements[0]
            if (elements.length > 0 && firstEl) {
              found = true
              count = elements.length
              sampleText = (await firstEl.textContent())?.trim().substring(0, 50) || ''
              break
            }
          }
        }

        results.push({ name, selector, found, count, sampleText })
      } else {
        const elements = await page.locator(selector).all()
        const found = elements.length > 0
        const count = elements.length
        let sampleText = ''
        const firstEl = elements[0]
        if (found && firstEl) {
          sampleText = (await firstEl.textContent())?.trim().substring(0, 50) || ''
        }
        results.push({ name, selector, found, count, sampleText })
      }
    } catch (error) {
      results.push({ name, selector, found: false, count: 0, sampleText: `Error: ${error}` })
    }
  }

  return results
}

async function testPage(
  browser: Browser,
  url: string,
  pageType: keyof typeof SELECTORS_BY_PAGE
): Promise<PageReport> {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  try {
    console.log(`  ${colors.cyan}Navigating to: ${url}${colors.reset}`)

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    if (!response?.ok()) {
      return {
        url,
        status: 'failed',
        error: `HTTP ${response?.status()}`,
        selectors: [],
      }
    }

    // Wait for dynamic content
    await page.waitForTimeout(3000)

    // Test selectors
    const selectors = SELECTORS_BY_PAGE[pageType]
    const selectorResults = await testSelectors(page, selectors)

    return {
      url,
      status: 'success',
      selectors: selectorResults,
    }
  } catch (error) {
    return {
      url,
      status: error instanceof Error && error.message.includes('Timeout') ? 'timeout' : 'failed',
      error: error instanceof Error ? error.message : String(error),
      selectors: [],
    }
  } finally {
    await context.close()
  }
}

function printReport(gameType: string, pageType: string, report: PageReport) {
  console.log(
    `\n${colors.bold}${colors.cyan}=== ${gameType.toUpperCase()} - ${pageType} ===${colors.reset}`
  )
  console.log(`URL: ${report.url}`)

  if (report.status !== 'success') {
    console.log(`${colors.red}Status: ${report.status} - ${report.error}${colors.reset}`)
    return
  }

  const found = report.selectors.filter(s => s.found).length
  const total = report.selectors.length
  const percentage = Math.round((found / total) * 100)

  const statusColor =
    percentage >= 70 ? colors.green : percentage >= 40 ? colors.yellow : colors.red
  console.log(`${statusColor}Selectors found: ${found}/${total} (${percentage}%)${colors.reset}\n`)

  for (const selector of report.selectors) {
    const icon = selector.found
      ? `${colors.green}✓${colors.reset}`
      : `${colors.red}✗${colors.reset}`
    const countStr = selector.found ? ` (${selector.count})` : ''
    const sampleStr = selector.sampleText ? ` "${selector.sampleText}"` : ''
    console.log(`  ${icon} ${selector.name}${countStr}${sampleStr}`)
  }
}

async function main() {
  console.log(`${colors.bold}${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║   Svenska Spel Scraper Selector Diagnostic Tool          ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`)

  // Parse command line args
  const args = process.argv.slice(2)
  const gameTypeArg = args.find(a => GAME_TYPES.includes(a as GameType)) as GameType | undefined
  const gameTypes = gameTypeArg ? [gameTypeArg] : GAME_TYPES
  const matchNumber = 1 // Test with first match

  console.log(`Testing game types: ${gameTypes.join(', ')}`)
  console.log(`Using match number: ${matchNumber}`)
  console.log('')

  const browser = await chromium.launch({ headless: true })

  try {
    for (const gameType of gameTypes) {
      console.log(
        `\n${colors.bold}${colors.yellow}━━━ Testing ${gameType.toUpperCase()} ━━━${colors.reset}`
      )

      // Test match page (matchInfo + quick bets)
      const matchPageUrl = `${BASE_URL}/${gameType}?event=${matchNumber}`
      const matchReport = await testPage(browser, matchPageUrl, 'matchPage')
      printReport(gameType, 'Match Page (matchInfo/oddset)', matchReport)

      // Test xStats page
      const xStatsUrl = `${BASE_URL}/${gameType}/xstats?event=${matchNumber}`
      const xStatsReport = await testPage(browser, xStatsUrl, 'xStats')
      printReport(gameType, 'xStats', xStatsReport)

      // Test statistics page
      const statisticsUrl = `${BASE_URL}/${gameType}/statistik?event=${matchNumber}`
      const statisticsReport = await testPage(browser, statisticsUrl, 'statistics')
      printReport(gameType, 'Statistics', statisticsReport)

      // Test table page
      const tableUrl = `${BASE_URL}/${gameType}/tabell?event=${matchNumber}`
      const tableReport = await testPage(browser, tableUrl, 'table')
      printReport(gameType, 'Table', tableReport)

      // Test lineup page
      const lineupUrl = `${BASE_URL}/${gameType}/laguppstallning?event=${matchNumber}`
      const lineupReport = await testPage(browser, lineupUrl, 'lineup')
      printReport(gameType, 'Lineup', lineupReport)

      // Test news page
      const newsUrl = `${BASE_URL}/${gameType}/nyheter?event=${matchNumber}`
      const newsReport = await testPage(browser, newsUrl, 'news')
      printReport(gameType, 'News', newsReport)

      // Test analysis page (draw-level, not match-specific)
      const analysisUrl = `${BASE_URL}/${gameType}/speltips`
      const analysisReport = await testPage(browser, analysisUrl, 'analysis')
      printReport(gameType, 'Analysis', analysisReport)

      // Test H2H on Statistics page (H2H is embedded there via Enetpulse widget)
      const h2hReport = await testPage(browser, statisticsUrl, 'headToHead')
      printReport(gameType, 'Head-to-Head (on Statistik page)', h2hReport)

      // Add delay between game types to avoid rate limiting
      if (gameTypes.indexOf(gameType) < gameTypes.length - 1) {
        console.log(`\n${colors.yellow}Waiting 5s before next game type...${colors.reset}`)
        await new Promise(r => setTimeout(r, 5000))
      }
    }

    // Print summary
    console.log(`\n${colors.bold}${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║                      SUMMARY                              ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`)
    console.log('Diagnostic complete. Review the output above to identify:')
    console.log('  - ${colors.green}✓${colors.reset} Selectors that are working')
    console.log('  - ${colors.red}✗${colors.reset} Selectors that need to be updated')
    console.log('')
    console.log('If many selectors are missing, the page structure may have changed.')
    console.log('Use browser DevTools to inspect the actual page and update scrapers.')
  } finally {
    await browser.close()
  }
}

main().catch(console.error)
