#!/usr/bin/env node
import 'dotenv/config'
import { prisma } from '../server/utils/prisma'

async function main() {
  const draws = await prisma.draws.findMany({
    where: { is_current: true },
    select: {
      id: true,
      draw_number: true,
      game_type: true,
      status: true,
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

  console.log('Current draws (is_current = true):')
  console.log('='.repeat(90))

  for (const draw of draws) {
    const matchesWithResults = draw.matches.filter(
      m => m.result_home !== null && m.result_away !== null && m.outcome !== null
    ).length
    const totalMatches = draw.matches.length
    const complete = matchesWithResults === totalMatches && totalMatches > 0

    const dateStr = draw.draw_date?.toISOString().split('T')[0] ?? 'N/A'
    console.log(
      `${draw.game_type.padEnd(12)} #${String(draw.draw_number).padStart(4)} | ` +
        `date: ${dateStr} | status: ${draw.status.padEnd(10)} | ` +
        `matches: ${matchesWithResults}/${totalMatches} ${complete ? '✓ COMPLETE' : ''}`
    )
  }

  console.log('='.repeat(90))
  console.log(`Total current draws: ${draws.length}`)

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
