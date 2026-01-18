#!/usr/bin/env node
import 'dotenv/config'
import { parseArgs } from 'node:util'
import type { Prisma } from '@prisma/client'
import { prisma } from '../server/utils/prisma'
import type { XStatsData } from '../types'
import {
  initializeAllTeamRatings,
  updateRatingsAfterMatch,
  DEFAULT_CONFIG,
} from '../server/services/statistical-calculations'

/**
 * CLI script for initializing and training team Elo ratings
 * Usage: npx tsx scripts/init-team-ratings.ts [options]
 *
 * Options:
 *   --init      Initialize all teams with default ratings
 *   --train     Train ratings using historical match results
 *   --version   Model version to use (default: v1.0)
 *   --limit     Limit number of matches for training (for testing)
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
  console.log('║   Team Ratings Initialization Tool     ║')
  console.log('╚════════════════════════════════════════╝')
  console.log(colors.reset)
}

async function initializeRatings(version: string): Promise<number> {
  console.log(
    `${colors.blue}Initializing all teams with default ratings (${version})...${colors.reset}`
  )
  const count = await initializeAllTeamRatings(version)
  console.log(`${colors.green}✓ Initialized ${count} teams${colors.reset}`)
  return count
}

async function trainRatings(version: string, limit?: number): Promise<void> {
  console.log(`${colors.blue}Training ratings using historical match results...${colors.reset}`)

  // Get all completed matches with results, ordered by date (oldest first)
  const whereClause: Prisma.matchesWhereInput = {
    outcome: { not: null },
    result_home: { not: null },
    result_away: { not: null },
  }

  const matches = await prisma.matches.findMany({
    where: whereClause,
    orderBy: { start_time: 'asc' },
    take: limit,
    include: {
      match_scraped_data: {
        where: { data_type: 'xStats' },
      },
    },
  })

  console.log(`Found ${matches.length} completed matches to process`)

  let processed = 0
  let errors = 0

  for (const match of matches) {
    try {
      // Extract xG if available
      let homeXg: number | undefined
      let awayXg: number | undefined

      const xStats = match.match_scraped_data.find(d => d.data_type === 'xStats')
      if (xStats?.data) {
        const data = xStats.data as XStatsData
        homeXg = data.homeTeam?.entireSeason?.xg
          ? parseFloat(data.homeTeam.entireSeason.xg)
          : undefined
        awayXg = data.awayTeam?.entireSeason?.xg
          ? parseFloat(data.awayTeam.entireSeason.xg)
          : undefined
      }

      await updateRatingsAfterMatch(
        {
          homeTeamId: match.home_team_id,
          awayTeamId: match.away_team_id,
          homeGoals: match.result_home!,
          awayGoals: match.result_away!,
          homeXg,
          awayXg,
          matchDate: match.start_time,
        },
        { ...DEFAULT_CONFIG, version }
      )

      processed++

      // Progress indicator
      if (processed % 100 === 0) {
        process.stdout.write(
          `\r${colors.dim}Processed ${processed}/${matches.length} matches...${colors.reset}`
        )
      }
    } catch (error) {
      errors++
      console.error(`\n${colors.red}Error processing match ${match.id}:${colors.reset}`, error)
    }
  }

  console.log(
    `\n${colors.green}✓ Training complete: ${processed} matches processed, ${errors} errors${colors.reset}`
  )
}

async function displayStats(version: string): Promise<void> {
  const stats = await prisma.team_ratings.groupBy({
    by: ['confidence'],
    where: { model_version: version, rating_type: 'elo' },
    _count: { _all: true },
  })

  console.log(`\n${colors.bright}Rating Statistics (${version}):${colors.reset}`)
  for (const stat of stats) {
    const emoji = stat.confidence === 'high' ? '🟢' : stat.confidence === 'medium' ? '🟡' : '🔴'
    console.log(`  ${emoji} ${stat.confidence}: ${stat._count._all} teams`)
  }

  // Show top and bottom rated teams
  const topRatings = await prisma.team_ratings.findMany({
    where: { model_version: version, rating_type: 'elo' },
    orderBy: { rating_value: 'desc' },
    take: 5,
  })

  const bottomRatings = await prisma.team_ratings.findMany({
    where: { model_version: version, rating_type: 'elo' },
    orderBy: { rating_value: 'asc' },
    take: 5,
  })

  // Fetch team names for display
  const teamIds = [...topRatings, ...bottomRatings].map(r => r.team_id)
  const teams = await prisma.teams.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, name: true },
  })
  const teamMap = new Map(teams.map(t => [t.id, t.name]))

  console.log(`\n${colors.bright}Top 5 Rated Teams:${colors.reset}`)
  for (const rating of topRatings) {
    const teamName = teamMap.get(rating.team_id) ?? `Team ${rating.team_id}`
    console.log(
      `  ${teamName}: ${Number(rating.rating_value).toFixed(0)} (${rating.matches_played} matches)`
    )
  }

  console.log(`\n${colors.bright}Bottom 5 Rated Teams:${colors.reset}`)
  for (const rating of bottomRatings) {
    const teamName = teamMap.get(rating.team_id) ?? `Team ${rating.team_id}`
    console.log(
      `  ${teamName}: ${Number(rating.rating_value).toFixed(0)} (${rating.matches_played} matches)`
    )
  }
}

async function main() {
  displayBanner()

  const { values } = parseArgs({
    options: {
      init: { type: 'boolean', default: false },
      train: { type: 'boolean', default: false },
      stats: { type: 'boolean', default: false },
      version: { type: 'string', default: DEFAULT_CONFIG.version },
      limit: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })

  if (values.help || (!values.init && !values.train && !values.stats)) {
    console.log(`
${colors.bright}Usage:${colors.reset} npx tsx scripts/init-team-ratings.ts [options]

${colors.bright}Options:${colors.reset}
  --init      Initialize all teams with default ratings (Elo=1500)
  --train     Train ratings using historical match results
  --stats     Display current rating statistics
  --version   Model version to use (default: ${DEFAULT_CONFIG.version})
  --limit     Limit number of matches for training (for testing)
  -h, --help  Show this help message

${colors.bright}Examples:${colors.reset}
  # Initialize all teams with default ratings
  npx tsx scripts/init-team-ratings.ts --init

  # Train ratings using all historical matches
  npx tsx scripts/init-team-ratings.ts --train

  # Initialize and train
  npx tsx scripts/init-team-ratings.ts --init --train

  # Train with limited matches (for testing)
  npx tsx scripts/init-team-ratings.ts --train --limit 100

  # Show current statistics
  npx tsx scripts/init-team-ratings.ts --stats
`)
    process.exit(0)
  }

  const version = values.version!
  const limit = values.limit ? parseInt(values.limit, 10) : undefined

  console.log(`${colors.dim}Model version: ${version}${colors.reset}`)
  if (limit) {
    console.log(`${colors.dim}Match limit: ${limit}${colors.reset}`)
  }
  console.log('')

  try {
    if (values.init) {
      await initializeRatings(version)
    }

    if (values.train) {
      await trainRatings(version, limit)
    }

    if (values.stats || values.init || values.train) {
      await displayStats(version)
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
