#!/usr/bin/env node
import 'dotenv/config'
import { parseArgs } from 'node:util'
import { prisma } from '../server/utils/prisma'

/**
 * CLI script for closing draws that have all match results OR are past their date
 * Usage: npx tsx scripts/close-completed-draws.ts [options]
 *
 * Options:
 *   --dry-run       Preview changes without applying them
 *   --verbose       Show detailed output for each draw
 *   --include-past  Also close draws whose draw_date has passed (even without results)
 *   --days N        Number of days in the past to consider "old" (default: 7)
 */

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
}

function displayBanner() {
  console.log(`${colors.bright}${colors.cyan}`)
  console.log('╔════════════════════════════════════════╗')
  console.log('║   Close Completed Draws Tool           ║')
  console.log('╚════════════════════════════════════════╝')
  console.log(colors.reset)
}

interface DrawData {
  id: number
  draw_number: number
  game_type: string
  status: string
  is_current: boolean
  draw_date: Date | null
  matches: {
    result_home: number | null
    result_away: number | null
    outcome: string | null
  }[]
}

interface DrawWithMatches extends DrawData {
  closeReason: 'all_results' | 'past_date'
}

async function findCompletedDraws(
  includePast: boolean,
  daysThreshold: number
): Promise<DrawWithMatches[]> {
  // Find all current draws with their matches
  const draws = await prisma.draws.findMany({
    where: { is_current: true },
    select: {
      id: true,
      draw_number: true,
      game_type: true,
      status: true,
      is_current: true,
      draw_date: true,
      matches: {
        select: {
          result_home: true,
          result_away: true,
          outcome: true,
        },
      },
    },
    orderBy: [{ game_type: 'asc' }, { draw_number: 'asc' }],
  })

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysThreshold)

  // Filter to draws that should be closed
  const results: DrawWithMatches[] = []

  for (const draw of draws) {
    const allMatchesHaveResults =
      draw.matches.length > 0 &&
      draw.matches.every(
        match => match.result_home !== null && match.result_away !== null && match.outcome !== null
      )

    const isPastDate = draw.draw_date && draw.draw_date < cutoffDate

    if (allMatchesHaveResults) {
      results.push({ ...draw, closeReason: 'all_results' })
    } else if (includePast && isPastDate) {
      results.push({ ...draw, closeReason: 'past_date' })
    }
  }

  return results
}

async function closeDraws(
  draws: DrawWithMatches[],
  dryRun: boolean,
  verbose: boolean
): Promise<{ closed: number; errors: number }> {
  let closed = 0
  let errors = 0

  for (const draw of draws) {
    try {
      const dateStr = draw.draw_date?.toISOString().split('T')[0] ?? 'N/A'
      const matchInfo = `${draw.matches.filter(m => m.outcome !== null).length}/${draw.matches.length}`
      const reasonText = draw.closeReason === 'all_results' ? 'all results' : 'past date'

      if (verbose) {
        console.log(
          `${colors.dim}  Processing ${draw.game_type} #${draw.draw_number} ` +
            `(date: ${dateStr}, matches: ${matchInfo}, reason: ${reasonText})${colors.reset}`
        )
      }

      if (!dryRun) {
        await prisma.draws.update({
          where: { id: draw.id },
          data: {
            status: 'Completed',
            is_current: false,
            archived_at: new Date(),
          },
        })
      }

      closed++

      if (verbose || dryRun) {
        const action = dryRun ? 'Would close' : 'Closed'
        console.log(
          `${colors.green}  ✓ ${action}: ${draw.game_type} #${draw.draw_number} (${dateStr}) [${reasonText}]${colors.reset}`
        )
      }
    } catch (error) {
      errors++
      console.error(
        `${colors.red}  ✗ Error closing ${draw.game_type} #${draw.draw_number}: ${error}${colors.reset}`
      )
    }
  }

  return { closed, errors }
}

async function main() {
  displayBanner()

  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'include-past': { type: 'boolean', default: false },
      days: { type: 'string', default: '7' },
      verbose: { type: 'boolean', short: 'v', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })

  if (values.help) {
    console.log('Usage: npx tsx scripts/close-completed-draws.ts [options]')
    console.log('')
    console.log('Options:')
    console.log('  --dry-run       Preview changes without applying them')
    console.log(
      '  --include-past  Also close draws whose draw_date has passed (even without results)'
    )
    console.log('  --days N        Number of days in the past to consider "old" (default: 7)')
    console.log('  --verbose       Show detailed output for each draw')
    console.log('  --help          Show this help message')
    process.exit(0)
  }

  const dryRun = values['dry-run'] ?? false
  const includePast = values['include-past'] ?? false
  const daysThreshold = parseInt(values.days ?? '7', 10)
  const verbose = values.verbose ?? false

  if (dryRun) {
    console.log(`${colors.yellow}Running in DRY-RUN mode - no changes will be made${colors.reset}`)
    console.log('')
  }

  // Find draws that should be closed
  if (includePast) {
    console.log(
      `${colors.blue}Finding draws with all match results OR past ${daysThreshold} days...${colors.reset}`
    )
  } else {
    console.log(`${colors.blue}Finding draws with all match results...${colors.reset}`)
  }
  const completedDraws = await findCompletedDraws(includePast, daysThreshold)

  if (completedDraws.length === 0) {
    console.log(`${colors.green}✓ No draws need to be closed${colors.reset}`)
    if (!includePast) {
      console.log(
        `${colors.dim}Tip: Use --include-past to also close draws whose date has passed${colors.reset}`
      )
    }
    await prisma.$disconnect()
    process.exit(0)
  }

  // Group by game type and reason for summary
  const byGameType = completedDraws.reduce(
    (acc, draw) => {
      acc[draw.game_type] = (acc[draw.game_type] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const byReason = completedDraws.reduce(
    (acc, draw) => {
      const reason = draw.closeReason ?? 'unknown'
      acc[reason] = (acc[reason] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  console.log(`${colors.cyan}Found ${completedDraws.length} draws to close:${colors.reset}`)
  for (const [gameType, count] of Object.entries(byGameType)) {
    console.log(`  - ${gameType}: ${count} draws`)
  }
  console.log('')
  console.log(`${colors.dim}By reason:${colors.reset}`)
  if (byReason.all_results) console.log(`  - All results: ${byReason.all_results}`)
  if (byReason.past_date) console.log(`  - Past date: ${byReason.past_date}`)
  console.log('')

  // Close the draws
  console.log(`${colors.blue}${dryRun ? 'Previewing' : 'Closing'} draws...${colors.reset}`)
  const { closed, errors } = await closeDraws(completedDraws, dryRun, verbose)

  // Summary
  console.log('')
  if (dryRun) {
    console.log(`${colors.yellow}DRY-RUN Summary:${colors.reset}`)
    console.log(`  Would close: ${closed} draws`)
    if (errors > 0) {
      console.log(`  ${colors.red}Errors: ${errors}${colors.reset}`)
    }
    console.log('')
    console.log(`${colors.dim}Run without --dry-run to apply changes${colors.reset}`)
  } else {
    console.log(`${colors.green}Summary:${colors.reset}`)
    console.log(`  ${colors.green}✓ Closed: ${closed} draws${colors.reset}`)
    if (errors > 0) {
      console.log(`  ${colors.red}✗ Errors: ${errors}${colors.reset}`)
    }
  }

  await prisma.$disconnect()
  process.exit(errors > 0 ? 1 : 0)
}

main().catch(async error => {
  console.error(`${colors.red}Fatal error: ${error}${colors.reset}`)
  await prisma.$disconnect()
  process.exit(1)
})
