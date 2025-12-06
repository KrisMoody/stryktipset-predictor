/**
 * Accessibility tree node structure from Playwright
 */
export interface AccessibilityNode {
  role?: string
  name?: string
  value?: string | number
  description?: string
  keyshortcuts?: string
  roledescription?: string
  valuetext?: string
  disabled?: boolean
  expanded?: boolean
  focused?: boolean
  modal?: boolean
  multiline?: boolean
  multiselectable?: boolean
  readonly?: boolean
  required?: boolean
  selected?: boolean
  checked?: boolean | 'mixed'
  pressed?: boolean | 'mixed'
  level?: number
  valuemin?: number
  valuemax?: number
  autocomplete?: string
  haspopup?: string
  invalid?: string
  orientation?: string
  children?: AccessibilityNode[]
}

/**
 * NOTE: The getAccessibilitySnapshot function has been removed as page.accessibility
 * is not part of the official Playwright API and is not available.
 * This file now only contains helper functions for data parsing.
 */

/**
 * Find all nodes matching a role
 */
export function findByRole(
  tree: AccessibilityNode | null,
  role: string,
  namePattern?: string | RegExp,
): AccessibilityNode[] {
  if (!tree) return []

  const results: AccessibilityNode[] = []

  function traverse(node: AccessibilityNode) {
    if (node.role === role) {
      if (!namePattern) {
        results.push(node)
      }
      else if (node.name) {
        const pattern = typeof namePattern === 'string'
          ? new RegExp(namePattern, 'i')
          : namePattern
        if (pattern.test(node.name)) {
          results.push(node)
        }
      }
    }

    if (node.children) {
      node.children.forEach(traverse)
    }
  }

  traverse(tree)
  return results
}

/**
 * Find first node matching criteria
 */
export function findFirst(
  tree: AccessibilityNode | null,
  role: string,
  namePattern?: string | RegExp,
): AccessibilityNode | null {
  const results = findByRole(tree, role, namePattern)
  return results[0] || null
}

/**
 * Find all links in the accessibility tree
 */
export function findLinks(tree: AccessibilityNode | null): Array<{ name: string, url: string }> {
  if (!tree) return []

  const links: Array<{ name: string, url: string }> = []

  function traverse(node: AccessibilityNode) {
    if (node.role === 'link' && node.name) {
      // Try to get the URL from the node's value or name
      const url = typeof node.value === 'string' ? node.value : ''
      if (url) {
        links.push({ name: node.name, url })
      }
    }

    if (node.children) {
      node.children.forEach(traverse)
    }
  }

  traverse(tree)
  return links
}

/**
 * Extract specific tab URLs from the accessibility tree
 */
export function extractTabUrls(
  tree: AccessibilityNode | null,
  tabs: string[] = ['statistik', 'xstats', 'head-to-head', 'nyheter'],
): Record<string, string> {
  const links = findLinks(tree)
  const tabUrls: Record<string, string> = {}

  for (const tab of tabs) {
    const link = links.find(l =>
      l.name.toLowerCase().includes(tab)
      || l.url.toLowerCase().includes(tab),
    )

    if (link) {
      tabUrls[tab] = link.url
    }
  }

  return tabUrls
}

/**
 * Extract table data from accessibility tree
 */
export function extractTableData(tableNode: AccessibilityNode): string[][] {
  const rows: string[][] = []

  function traverseTable(node: AccessibilityNode) {
    if (node.role === 'row') {
      const rowData: string[] = []
      if (node.children) {
        node.children.forEach((child) => {
          if (child.role === 'cell' || child.role === 'columnheader' || child.role === 'rowheader') {
            rowData.push(child.name || String(child.value) || '')
          }
        })
      }
      if (rowData.length > 0) {
        rows.push(rowData)
      }
    }

    if (node.children) {
      node.children.forEach(child => traverseTable(child))
    }
  }

  traverseTable(tableNode)
  return rows
}

/**
 * Parse statistics from table rows
 * Maps Swedish and English labels to standardized keys
 */
export function parseStatsFromTable(rows: string[][]): Record<string, any> {
  const stats: Record<string, any> = {}

  for (const row of rows) {
    if (row.length < 2) continue

    const label = row[0]?.toLowerCase() || ''
    const homeValue = row[1]
    const awayValue = row[row.length - 1]

    // Map Swedish and English labels to keys
    const mappings: Record<string, string> = {
      'placering': 'position',
      'position': 'position',
      'poäng': 'points',
      'points': 'points',
      'spelade': 'played',
      'played': 'played',
      'matcher': 'played',
      'games': 'played',
      'vunna': 'won',
      'won': 'won',
      'segrar': 'won',
      'wins': 'won',
      'oavgjorda': 'drawn',
      'drawn': 'drawn',
      'oavgjort': 'drawn',
      'draws': 'drawn',
      'förlorade': 'lost',
      'lost': 'lost',
      'förluster': 'lost',
      'losses': 'lost',
      'gjorda mål': 'goalsFor',
      'goals for': 'goalsFor',
      'mål för': 'goalsFor',
      'gf': 'goalsFor',
      'insläppta': 'goalsAgainst',
      'goals against': 'goalsAgainst',
      'mål emot': 'goalsAgainst',
      'ga': 'goalsAgainst',
      'målskillnad': 'goalDifference',
      'goal difference': 'goalDifference',
      'gd': 'goalDifference',
      'xg': 'xg',
      'xga': 'xga',
      'xgd': 'xgd',
      'xp': 'xp',
      'förväntade poäng': 'xp',
      'expected points': 'xp',
      'förväntade mål': 'xg',
      'expected goals': 'xg',
    }

    for (const [key, value] of Object.entries(mappings)) {
      if (label.includes(key)) {
        if (!stats.home) stats.home = {}
        if (!stats.away) stats.away = {}

        // Try to parse as number, otherwise keep as string
        const homeNum = parseFloat(homeValue || '')
        const awayNum = parseFloat(awayValue || '')

        stats.home[value] = !isNaN(homeNum) ? homeNum : homeValue
        stats.away[value] = !isNaN(awayNum) ? awayNum : awayValue
        break
      }
    }
  }

  return stats
}

/**
 * Extract all text from a node and its children
 */
export function extractAllText(node: AccessibilityNode): string {
  let text = node.name || String(node.value || '') || ''

  if (node.children) {
    node.children.forEach((child) => {
      const childText = extractAllText(child)
      if (childText) {
        text += ' ' + childText
      }
    })
  }

  return text.trim()
}

/**
 * Find form data (W/D/L sequences) in accessibility tree
 */
export function extractFormData(tree: AccessibilityNode | null): { home?: string[], away?: string[] } {
  if (!tree) return {}

  try {
    // Look for elements with "form" in their accessible name or role
    const formNodes = findByRole(tree, 'list', /form/i)

    if (formNodes.length > 0) {
      // Parse form letters (W, D, L or V, O, F in Swedish)
      const formTexts = formNodes.map(node => extractAllText(node))

      return {
        home: formTexts[0]?.split('').filter(c => ['W', 'D', 'L', 'V', 'O', 'F'].includes(c.toUpperCase())),
        away: formTexts[1]?.split('').filter(c => ['W', 'D', 'L', 'V', 'O', 'F'].includes(c.toUpperCase())),
      }
    }

    // Alternative: look for any text containing form indicators
    const allText = extractAllText(tree)
    const matches = allText.match(/[WDLVOF]{3,}/gi)

    if (matches && matches.length >= 2 && matches[0] && matches[1]) {
      return {
        home: matches[0].toUpperCase().split(''),
        away: matches[1].toUpperCase().split(''),
      }
    }
  }
  catch (error) {
    console.error('[Accessibility] Error extracting form data:', error)
  }

  return {}
}

/**
 * Extract head-to-head match history from table
 */
export function parseH2HMatches(rows: string[][]): Array<{
  date: string
  homeTeam: string
  awayTeam: string
  score: string
  competition?: string
}> {
  const matches: Array<any> = []

  for (const row of rows) {
    if (row.length >= 3) {
      matches.push({
        date: row[0]?.trim() || '',
        homeTeam: row[1]?.trim() || '',
        score: row[2]?.trim() || '',
        awayTeam: row[3]?.trim() || '',
        competition: row[4]?.trim() || undefined,
      })
    }
  }

  return matches
}

/**
 * Calculate H2H summary from matches
 */
export function calculateH2HSummary(matches: Array<{ score: string }>): {
  homeWins: number
  draws: number
  awayWins: number
  totalMatches: number
} {
  let homeWins = 0
  let draws = 0
  let awayWins = 0

  for (const match of matches) {
    if (match.score) {
      const scoreParts = match.score.split('-')
      if (scoreParts.length === 2 && scoreParts[0] && scoreParts[1]) {
        const home = parseInt(scoreParts[0])
        const away = parseInt(scoreParts[1])

        if (!isNaN(home) && !isNaN(away)) {
          if (home > away) homeWins++
          else if (home < away) awayWins++
          else draws++
        }
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

/**
 * Extract news articles from accessibility tree
 */
export function parseNewsArticles(tree: AccessibilityNode | null): Array<{
  title: string
  content?: string
  date?: string
  source?: string
}> {
  if (!tree) return []

  const articles: Array<any> = []

  // Find article elements or list items that might contain news
  const articleNodes = [
    ...findByRole(tree, 'article'),
    ...findByRole(tree, 'listitem'),
  ]

  for (const node of articleNodes) {
    // Look for headings within the article
    const headings = findByRole(node, 'heading')
    const title = headings[0]?.name || node.name

    if (title) {
      // Extract all text from the article
      const fullText = extractAllText(node)

      articles.push({
        title: title.trim(),
        content: fullText.trim() || undefined,
        source: 'Svenska Spel',
      })
    }
  }

  return articles
}
