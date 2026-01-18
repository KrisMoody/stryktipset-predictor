#!/usr/bin/env node
import 'dotenv/config'
import { parseArgs } from 'node:util'
import { prisma } from '../server/utils/prisma'
import {
  recalculateDrawStatistics,
  getDrawCalculationStatus,
  DEFAULT_CONFIG,
} from '../server/services/statistical-calculations'

/**
 * CLI script for backfilling statistical calculations for existing matches
 * Usage: npx tsx scripts/backfill-calculations.ts [options]
 *
 * Options:
 *   --draws     Specific draw IDs to process (comma-separated)
 *   --recent    Process N most recent draws
 *   --all       Process all draws
 *   --force     Force recalculation even if calculations exist
 *   --status    Show calculation status without processing
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
  console.log('║   Statistical Calculations Backfill    ║')
  console.log('╚════════════════════════════════════════╝')
  console.log(colors.reset)
}

async function showStatus(drawIds?: number[]): Promise<void> {
  let draws
  if (drawIds && drawIds.length > 0) {
    draws = await prisma.draws.findMany({
      where: { id: { in: drawIds } },
      orderBy: { draw_date: 'desc' },
      select: { id: true, draw_number: true, game_type: true, status: true },
    })
  } else {
    draws = await prisma.draws.findMany({
      orderBy: { draw_date: 'desc' },
      take: 10,
      select: { id: true, draw_number: true, game_type: true, status: true },
    })
  }

  console.log(`\n${colors.bright}Calculation Status:${colors.reset}\n`)

  for (const draw of draws) {
    const status = await getDrawCalculationStatus(draw.id)
    const pct = status.total > 0 ? Math.round((status.calculated / status.total) * 100) : 0
    const statusColor = pct === 100 ? colors.green : pct > 50 ? colors.yellow : colors.red

    console.log(
      `  ${draw.game_type} #${draw.draw_number} (${draw.status}): ` +
        `${statusColor}${status.calculated}/${status.total}${colors.reset} (${pct}%)`
    )
  }
  console.log('')
}

async function processDraws(
  drawIds: number[],
  options: { force: boolean }
): Promise<{ totalCalculated: number; totalSkipped: number; totalFailed: number }> {
  let totalCalculated = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (let i = 0; i < drawIds.length; i++) {
    const drawId = drawIds[i]!

    // Get draw info for logging
    const draw = await prisma.draws.findUnique({
      where: { id: drawId },
      select: { draw_number: true, game_type: true },
    })

    if (!draw) {
      console.log(`${colors.yellow}⚠️ Draw ${drawId} not found, skipping${colors.reset}`)
      continue
    }

    process.stdout.write(
      `\r${colors.dim}[${i + 1}/${drawIds.length}] Processing ${draw.game_type} #${draw.draw_number}...${colors.reset}`
    )

    const result = await recalculateDrawStatistics(drawId, {
      forceRecalculate: options.force,
      config: DEFAULT_CONFIG,
    })

    totalCalculated += result.calculated
    totalSkipped += result.skipped
    totalFailed += result.failed

    // Show progress
    const statusEmoji = result.failed > 0 ? '⚠️' : '✓'
    console.log(
      `\r${statusEmoji} ${draw.game_type} #${draw.draw_number}: ` +
        `${colors.green}+${result.calculated}${colors.reset} ` +
        `${colors.dim}⊘${result.skipped}${colors.reset} ` +
        `${result.failed > 0 ? colors.red : colors.dim}✗${result.failed}${colors.reset}`
    )
  }

  return { totalCalculated, totalSkipped, totalFailed }
}

async function main() {
  displayBanner()

  const { values } = parseArgs({
    options: {
      draws: { type: 'string' },
      recent: { type: 'string' },
      all: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      status: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })

  if (values.help) {
    console.log(`
${colors.bright}Usage:${colors.reset} npx tsx scripts/backfill-calculations.ts [options]

${colors.bright}Options:${colors.reset}
  --draws     Specific draw IDs to process (comma-separated)
  --recent N  Process N most recent draws
  --all       Process all draws (use with caution!)
  --force     Force recalculation even if calculations exist
  --status    Show calculation status without processing
  -h, --help  Show this help message

${colors.bright}Examples:${colors.reset}
  # Show status of recent draws
  npx tsx scripts/backfill-calculations.ts --status

  # Process specific draws
  npx tsx scripts/backfill-calculations.ts --draws 123,124,125

  # Process 5 most recent draws
  npx tsx scripts/backfill-calculations.ts --recent 5

  # Force recalculation of all matches in recent draws
  npx tsx scripts/backfill-calculations.ts --recent 3 --force
`)
    process.exit(0)
  }

  try {
    // Determine which draws to process
    let drawIds: number[] = []

    if (values.draws) {
      drawIds = values.draws.split(',').map(id => parseInt(id.trim(), 10))
    } else if (values.recent) {
      const count = parseInt(values.recent, 10)
      const draws = await prisma.draws.findMany({
        orderBy: { draw_date: 'desc' },
        take: count,
        select: { id: true },
      })
      drawIds = draws.map(d => d.id)
    } else if (values.all) {
      const draws = await prisma.draws.findMany({
        select: { id: true },
      })
      drawIds = draws.map(d => d.id)
    }

    if (values.status) {
      await showStatus(drawIds.length > 0 ? drawIds : undefined)
      process.exit(0)
    }

    if (drawIds.length === 0) {
      console.log(
        `${colors.yellow}No draws specified. Use --draws, --recent, or --all${colors.reset}`
      )
      console.log(`Use --help for more information\n`)
      process.exit(1)
    }

    console.log(`${colors.blue}Processing ${drawIds.length} draws...${colors.reset}`)
    if (values.force) {
      console.log(`${colors.yellow}Force mode: will recalculate all matches${colors.reset}`)
    }
    console.log('')

    const result = await processDraws(drawIds, { force: values.force || false })

    console.log(`\n${colors.bright}Summary:${colors.reset}`)
    console.log(`  ${colors.green}✓ Calculated: ${result.totalCalculated}${colors.reset}`)
    console.log(`  ${colors.dim}⊘ Skipped: ${result.totalSkipped}${colors.reset}`)
    if (result.totalFailed > 0) {
      console.log(`  ${colors.red}✗ Failed: ${result.totalFailed}${colors.reset}`)
    }

    console.log(`\n${colors.green}${colors.bright}Done!${colors.reset}`)
  } catch (error) {
    console.error(`\n${colors.red}Error:${colors.reset}`, error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
