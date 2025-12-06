#!/usr/bin/env node
import 'dotenv/config'
import { parseArgs } from 'node:util'
import { seasonBackfillService, type BackfillProgress } from '../server/services/season-backfill'
import { prisma } from '../server/utils/prisma'

/**
 * CLI script for running season backfill
 * Usage: npx tsx scripts/backfill-season.ts [options]
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
  console.log('║   Stryktipset Season Backfill Tool    ║')
  console.log('╚════════════════════════════════════════╝')
  console.log(colors.reset)
}

function displayProgress(progress: BackfillProgress) {
  const phaseEmoji = {
    discovery: '🔍',
    filtering: '🔎',
    processing: '⚙️',
    archiving: '📦',
    complete: '✅',
  }

  const emoji = phaseEmoji[progress.phase] || '📊'

  // Clear previous line and display progress
  if (progress.phase !== 'complete') {
    process.stdout.write('\r\x1b[K') // Clear line
  }

  if (progress.phase === 'discovery') {
    process.stdout.write(`${emoji} Discovering draws...`)
  } else if (progress.phase === 'filtering') {
    process.stdout.write(`${emoji} Filtering existing draws (found ${progress.totalDraws})...`)
  } else if (progress.phase === 'processing') {
    const percentage =
      progress.totalDraws > 0
        ? Math.round((progress.processedDraws / progress.totalDraws) * 100)
        : 0

    const batchInfo =
      progress.currentBatch && progress.totalBatches
        ? ` [Batch ${progress.currentBatch}/${progress.totalBatches}]`
        : ''

    process.stdout.write(
      `${emoji} Processing: ${progress.processedDraws}/${progress.totalDraws} ` +
        `(${percentage}%)${batchInfo} - ` +
        `${colors.green}✓${progress.successfulDraws}${colors.reset} ` +
        `${colors.red}✗${progress.failedDraws}${colors.reset} ` +
        `${colors.dim}⊘${progress.skippedDraws}${colors.reset}`
    )
  } else if (progress.phase === 'archiving') {
    process.stdout.write(`${emoji} Archiving ${progress.successfulDraws} draws...`)
  } else if (progress.phase === 'complete') {
    console.log(`\n${emoji} ${colors.green}${colors.bright}Complete!${colors.reset}`)
  }
}

interface BackfillResult {
  totalDraws: number
  processedDraws: number
  successfulDraws: number
  failedDraws: number
  skippedDraws: number
  duration: number
  errors: Array<{ drawNumber: number; error: string }>
  success: boolean
}

function displaySummary(result: BackfillResult) {
  console.log(`\n${colors.bright}${colors.cyan}Summary:${colors.reset}`)
  console.log(`${colors.dim}${'─'.repeat(50)}${colors.reset}`)

  console.log(`Total Draws:      ${colors.bright}${result.totalDraws}${colors.reset}`)
  console.log(`Processed:        ${result.processedDraws}`)
  console.log(`${colors.green}Successful:       ${result.successfulDraws}${colors.reset}`)

  if (result.failedDraws > 0) {
    console.log(`${colors.red}Failed:           ${result.failedDraws}${colors.reset}`)
  }

  if (result.skippedDraws > 0) {
    console.log(`${colors.dim}Skipped:          ${result.skippedDraws}${colors.reset}`)
  }

  const durationSeconds = (result.duration / 1000).toFixed(2)
  console.log(`Duration:         ${durationSeconds}s`)

  console.log(`${colors.dim}${'─'.repeat(50)}${colors.reset}`)

  if (result.errors && result.errors.length > 0) {
    console.log(`\n${colors.red}${colors.bright}Errors:${colors.reset}`)
    for (const error of result.errors.slice(0, 10)) {
      console.log(`  ${colors.red}•${colors.reset} Draw ${error.drawNumber}: ${error.error}`)
    }
    if (result.errors.length > 10) {
      console.log(`  ${colors.dim}... and ${result.errors.length - 10} more${colors.reset}`)
    }
  }

  if (result.success) {
    console.log(
      `\n${colors.green}${colors.bright}✓ Backfill completed successfully!${colors.reset}\n`
    )
  } else {
    console.log(
      `\n${colors.yellow}${colors.bright}⚠ Backfill completed with errors${colors.reset}\n`
    )
  }
}

// Module-level variable for operation tracking (needed for SIGINT handler)
let operationId: number | null = null

async function main() {
  displayBanner()

  // Parse command-line arguments
  const { values } = parseArgs({
    options: {
      'start-date': {
        type: 'string',
        default: '2025-08-01',
        short: 's',
      },
      'end-date': {
        type: 'string',
        default: new Date().toISOString().split('T')[0],
        short: 'e',
      },
      'batch-size': {
        type: 'string',
        default: '15',
        short: 'b',
      },
      'dry-run': {
        type: 'boolean',
        default: false,
        short: 'd',
      },
      'skip-existing': {
        type: 'boolean',
        default: true,
      },
      'no-archive': {
        type: 'boolean',
        default: false,
      },
      help: {
        type: 'boolean',
        default: false,
        short: 'h',
      },
    },
    strict: false,
  })

  // Display help
  if (values.help) {
    console.log('Usage: npx tsx scripts/backfill-season.ts [options]\n')
    console.log('Options:')
    console.log('  -s, --start-date <date>    Start date (YYYY-MM-DD) [default: 2025-08-01]')
    console.log('  -e, --end-date <date>      End date (YYYY-MM-DD) [default: today]')
    console.log('  -b, --batch-size <number>  Draws per batch [default: 15]')
    console.log('  -d, --dry-run              Discovery only, no sync')
    console.log('  --skip-existing            Skip draws already in DB [default: true]')
    console.log("  --no-archive               Don't mark draws as historic")
    console.log('  -h, --help                 Display this help message\n')
    console.log('Examples:')
    console.log('  npx tsx scripts/backfill-season.ts')
    console.log(
      '  npx tsx scripts/backfill-season.ts --start-date=2025-08-01 --end-date=2025-11-01'
    )
    console.log('  npx tsx scripts/backfill-season.ts --dry-run')
    console.log('  npx tsx scripts/backfill-season.ts --batch-size=5\n')
    process.exit(0)
  }

  const startDate = new Date(values['start-date'] as string)
  const endDate = new Date(values['end-date'] as string)
  const batchSize = parseInt(values['batch-size'] as string, 10)
  const dryRun = values['dry-run'] as boolean
  const skipExisting = values['skip-existing'] as boolean
  const archiveOnComplete = !(values['no-archive'] as boolean)

  // Validate dates
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.error(`${colors.red}Error: Invalid date format. Use YYYY-MM-DD${colors.reset}`)
    process.exit(1)
  }

  if (startDate > endDate) {
    console.error(
      `${colors.red}Error: Start date must be before or equal to end date${colors.reset}`
    )
    process.exit(1)
  }

  if (isNaN(batchSize) || batchSize < 1) {
    console.error(`${colors.red}Error: Batch size must be a positive number${colors.reset}`)
    process.exit(1)
  }

  // Display configuration
  console.log(`${colors.bright}Configuration:${colors.reset}`)
  console.log(`  Date Range:       ${values['start-date']} → ${values['end-date']}`)
  console.log(`  Batch Size:       ${batchSize}`)
  console.log(`  Skip Existing:    ${skipExisting ? 'Yes' : 'No'}`)
  console.log(`  Archive on Complete: ${archiveOnComplete ? 'Yes' : 'No'}`)

  if (dryRun) {
    console.log(
      `  ${colors.yellow}${colors.bright}Mode: DRY RUN (no changes will be made)${colors.reset}`
    )
  }

  console.log()

  // Create operation record in database
  const operation = await prisma.backfill_operations.create({
    data: {
      operation_type: 'season',
      start_date: startDate,
      end_date: endDate,
      status: 'running',
      total_draws: 0,
      config: {
        batchSize,
        skipExisting,
        archiveOnComplete,
        dryRun,
      },
    },
  })

  operationId = operation.id
  console.log(`${colors.dim}Operation ID: ${operation.id}${colors.reset}\n`)

  // Handle Ctrl+C gracefully
  let cancelRequested = false
  process.on('SIGINT', async () => {
    if (cancelRequested) {
      if (operationId) {
        try {
          await prisma.backfill_operations.update({
            where: { id: operationId },
            data: {
              status: 'cancelled',
              cancelled_at: new Date(),
            },
          })
        } catch {
          // Ignore errors during cleanup
        }
      }
      console.log(`\n${colors.red}Force exit${colors.reset}`)
      process.exit(1)
    }

    console.log(
      `\n${colors.yellow}Cancellation requested... (press Ctrl+C again to force exit)${colors.reset}`
    )
    cancelRequested = true
    seasonBackfillService.cancel()
  })

  try {
    // Run backfill
    const result = await seasonBackfillService.backfillSeason({
      startDate,
      endDate,
      batchSize,
      skipExisting,
      archiveOnComplete: dryRun ? false : archiveOnComplete,
      progressCallback: async progress => {
        displayProgress(progress)

        // Update database with progress
        if (operationId) {
          try {
            await prisma.backfill_operations.update({
              where: { id: operationId },
              data: {
                total_draws: progress.totalDraws,
                processed_draws: progress.processedDraws,
                successful_draws: progress.successfulDraws,
                failed_draws: progress.failedDraws,
                skipped_draws: progress.skippedDraws,
                error_log:
                  progress.errors.length > 0
                    ? JSON.parse(JSON.stringify(progress.errors))
                    : undefined,
              },
            })
          } catch {
            // Non-fatal - just log warning
            console.warn(
              `\n${colors.yellow}Warning: Failed to update operation progress${colors.reset}`
            )
          }
        }
      },
    })

    // Update final operation status
    if (operationId) {
      await prisma.backfill_operations.update({
        where: { id: operationId },
        data: {
          status: result.success ? 'completed' : 'failed',
          total_draws: result.totalDraws,
          processed_draws: result.processedDraws,
          successful_draws: result.successfulDraws,
          failed_draws: result.failedDraws,
          skipped_draws: result.skippedDraws,
          error_log:
            result.errors.length > 0 ? JSON.parse(JSON.stringify(result.errors)) : undefined,
          completed_at: new Date(),
        },
      })
    }

    // Display summary
    displaySummary(result)

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1)
  } catch (error) {
    // Update operation as failed
    if (operationId) {
      try {
        await prisma.backfill_operations.update({
          where: { id: operationId },
          data: {
            status: 'failed',
            error_log: [
              {
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            ],
            completed_at: new Date(),
          },
        })
      } catch {
        // Ignore database errors during error handling
      }
    }

    console.error(`\n${colors.red}${colors.bright}Fatal Error:${colors.reset}`)
    console.error(error)
    process.exit(1)
  }
}

// Run main function
main()
