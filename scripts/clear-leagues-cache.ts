/**
 * Clear the API-Football leagues cache
 *
 * Run with: npx tsx scripts/clear-leagues-cache.ts
 *
 * This script directly accesses the database to clear stale cache entries.
 * It doesn't need the Nuxt runtime.
 */

import 'dotenv/config'
import { prisma } from '../server/utils/prisma'

async function main() {
  console.log('Clearing API-Football leagues cache...\n')

  // Check what's in the cache
  const cacheEntries = await prisma.api_football_cache.findMany({
    where: { endpoint: '/leagues' },
    select: {
      id: true,
      endpoint: true,
      expires_at: true,
      created_at: true,
      response: true,
    },
  })

  console.log(`Found ${cacheEntries.length} cache entries for /leagues endpoint`)

  for (const entry of cacheEntries) {
    const response = entry.response as { response?: unknown[] } | null
    const leagueCount = Array.isArray(response?.response) ? response.response.length : 0
    const isExpired = entry.expires_at < new Date()

    console.log(`  - ID: ${entry.id}`)
    console.log(`    Created: ${entry.created_at.toISOString()}`)
    console.log(`    Expires: ${entry.expires_at.toISOString()} ${isExpired ? '(EXPIRED)' : ''}`)
    console.log(`    Leagues in cache: ${leagueCount}`)

    if (leagueCount === 0) {
      console.log(`    WARNING: Empty leagues cache!`)
    }
  }

  // Delete all leagues cache entries
  const result = await prisma.api_football_cache.deleteMany({
    where: { endpoint: '/leagues' },
  })

  console.log(`\nDeleted ${result.count} cache entries`)

  // Also check for any cache entries with empty responses
  const emptyEntries = await prisma.api_football_cache.findMany({
    where: {
      response: {
        path: ['response'],
        equals: [],
      },
    },
    select: { id: true, endpoint: true },
  })

  if (emptyEntries.length > 0) {
    console.log(`\nFound ${emptyEntries.length} cache entries with empty responses:`)
    for (const entry of emptyEntries) {
      console.log(`  - ${entry.endpoint} (ID: ${entry.id})`)
    }

    const deleteEmpty = await prisma.api_football_cache.deleteMany({
      where: {
        response: {
          path: ['response'],
          equals: [],
        },
      },
    })
    console.log(`Deleted ${deleteEmpty.count} empty cache entries`)
  }

  console.log('\nDone! Restart your dev server to fetch fresh leagues from API-Football.')
  console.log('You should see "[LeagueMatcher] Fetching leagues from API-Football..." in the logs.')

  process.exit(0)
}

main().catch(async error => {
  console.error('Error:', error)
  process.exit(1)
})
