/**
 * Discovery script to find actual CSS classes on Svenska Spel pages
 * Run with: npx tsx scripts/discover-page-classes.ts [page-type]
 *
 * page-type: news, statistics, match, all (default)
 */

import { chromium, type Page } from 'playwright'

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
}

const BASE_URL = 'https://spela.svenskaspel.se'

interface ClassDiscovery {
  url: string
  uniqueClasses: string[]
  classPatterns: Record<string, string[]>
  containerStructure: string[]
}

async function discoverClasses(page: Page): Promise<ClassDiscovery> {
  // Get ALL unique class names on the page
  const allClasses = (await page.evaluate(`
    (() => {
      const classes = new Set();
      document.querySelectorAll('*').forEach(el => {
        el.classList.forEach(c => classes.add(c));
      });
      return Array.from(classes).sort();
    })()
  `)) as string[]

  // Group classes by pattern
  const patterns: Record<string, string[]> = {
    news: allClasses.filter(c => /news|article|story|content|post|feed/i.test(c)),
    betting: allClasses.filter(c => /bet|odds|outcome|market|quick|wager/i.test(c)),
    statistics: allClasses.filter(c => /stat|table|league|standing|position|form/i.test(c)),
    team: allClasses.filter(c => /team|home|away|participant|player/i.test(c)),
    enetpulse: allClasses.filter(c => /wff_/i.test(c)),
    match: allClasses.filter(c => /match|game|event|fixture/i.test(c)),
    button: allClasses.filter(c => /btn|button|cta|link/i.test(c)),
    container: allClasses.filter(c => /container|wrapper|section|content|area|main/i.test(c)),
  }

  // Get container structure (main content area)
  const containerStructure = (await page.evaluate(`
    (() => {
      const structure = [];
      const mainContent = document.querySelector('main, [role="main"], .main-content, #content, #app, #root');
      if (mainContent) {
        const walk = (el, depth) => {
          if (depth > 3) return;
          const cls = el.className && typeof el.className === 'string' ? '.' + Array.from(el.classList).join('.') : '';
          const id = el.id ? '#' + el.id : '';
          const tag = el.tagName.toLowerCase();
          if (cls || id) {
            structure.push('  '.repeat(depth) + tag + id + cls);
          }
          Array.from(el.children).slice(0, 5).forEach(child => walk(child, depth + 1));
        };
        walk(mainContent, 0);
      }
      return structure;
    })()
  `)) as string[]

  return {
    url: page.url(),
    uniqueClasses: allClasses,
    classPatterns: patterns,
    containerStructure,
  }
}

async function discoverPage(url: string, name: string) {
  console.log(`\n${colors.bold}${colors.cyan}=== Discovering: ${name} ===${colors.reset}`)
  console.log(`URL: ${url}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000) // Wait for dynamic content

    const discovery = await discoverClasses(page)

    // Print patterns found
    console.log(`\n${colors.yellow}Classes by Pattern:${colors.reset}`)
    for (const [pattern, classes] of Object.entries(discovery.classPatterns)) {
      if (classes.length > 0) {
        console.log(`\n  ${colors.green}${pattern}:${colors.reset} (${classes.length} classes)`)
        classes.slice(0, 15).forEach(c => console.log(`    - ${c}`))
        if (classes.length > 15) {
          console.log(`    ... and ${classes.length - 15} more`)
        }
      }
    }

    // Print container structure
    if (discovery.containerStructure.length > 0) {
      console.log(`\n${colors.yellow}Container Structure:${colors.reset}`)
      discovery.containerStructure.slice(0, 20).forEach(s => console.log(`  ${s}`))
    }

    // Print total class count
    console.log(
      `\n${colors.cyan}Total unique classes: ${discovery.uniqueClasses.length}${colors.reset}`
    )

    return discovery
  } catch (error) {
    console.error(`${colors.red}Error: ${error}${colors.reset}`)
    return null
  } finally {
    await browser.close()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const pageType = args[0] || 'all'

  console.log(`${colors.bold}${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║   Svenska Spel Page Class Discovery Tool                 ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`)

  const pages = {
    news: `${BASE_URL}/stryktipset/nyheter?event=1`,
    statistics: `${BASE_URL}/stryktipset/statistik?event=1`,
    match: `${BASE_URL}/stryktipset?event=1`,
  }

  if (pageType === 'all') {
    for (const [name, url] of Object.entries(pages)) {
      await discoverPage(url, name)
      console.log('\n' + '─'.repeat(60))
    }
  } else if (pages[pageType as keyof typeof pages]) {
    await discoverPage(pages[pageType as keyof typeof pages], pageType)
  } else {
    console.log(`Unknown page type: ${pageType}`)
    console.log(`Valid options: news, statistics, match, all`)
  }
}

main().catch(console.error)
