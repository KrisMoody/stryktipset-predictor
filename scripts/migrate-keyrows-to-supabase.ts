/**
 * Simple migration script to upload precomputed key rows to Supabase
 *
 * Usage:
 * 1. Set your Supabase credentials in .env:
 *    SUPABASE_URL=https://your-project.supabase.co
 *    SUPABASE_SECRET_KEY=your-service-role-key
 *
 * 2. Run: npx tsx scripts/migrate-keyrows-to-supabase.ts
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('❌ Missing environment variables!')
  console.error('Please set SUPABASE_URL and SUPABASE_SECRET_KEY in your .env file')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)

interface BettingSystem {
  id: string
  type: 'R' | 'U'
  helgarderingar: number
  halvgarderingar: number
  rows: number
  guarantee?: number
  keyRows: number[][]
}

/**
 * Ensure database tables exist
 */
async function ensureTables() {
  console.log('📋 Checking database tables...\n')

  // Check if tables exist
  const { error: checkError } = await supabase
    .from('betting_systems')
    .select('id', { count: 'exact', head: true })
    .limit(1)

  if (checkError && checkError.code === '42P01') {
    // Table doesn't exist
    console.error('❌ Tables not found!')
    console.error('\nPlease create tables first by running this SQL in Supabase SQL Editor:\n')
    console.error('─'.repeat(60))
    console.error(`
CREATE TABLE IF NOT EXISTS betting_systems (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('R', 'U')),
  helgarderingar INT NOT NULL,
  halvgarderingar INT NOT NULL,
  rows INT NOT NULL,
  guarantee INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_key_rows (
  system_id TEXT REFERENCES betting_systems(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  row_data JSONB NOT NULL,
  PRIMARY KEY (system_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_system_key_rows_system ON system_key_rows(system_id);
    `)
    console.error('─'.repeat(60))
    process.exit(1)
  }

  console.log('✅ Tables exist\n')
}

/**
 * Load systems from JSON file
 */
function loadSystems(): BettingSystem[] {
  const inputPath = path.join(__dirname, '../server/constants/betting-systems-with-keyrows.json')

  if (!fs.existsSync(inputPath)) {
    console.error('❌ File not found:', inputPath)
    console.error('Please run the precompute script first!')
    process.exit(1)
  }

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
  return [...data['R-systems'], ...data['U-systems']]
}

/**
 * Migrate a single system (with UPSERT to handle duplicates)
 */
async function migrateSystem(system: BettingSystem): Promise<void> {
  const startTime = Date.now()

  console.log(`\n📦 Migrating ${system.id}...`)
  console.log(`   Rows: ${system.keyRows.length}`)

  // 1. Upsert system metadata
  const { error: systemError } = await supabase.from('betting_systems').upsert(
    {
      id: system.id,
      type: system.type,
      helgarderingar: system.helgarderingar,
      halvgarderingar: system.halvgarderingar,
      rows: system.rows,
      guarantee: system.guarantee || null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'id',
    }
  )

  if (systemError) {
    console.error(`   ❌ Failed to upsert system metadata:`, systemError.message)
    throw systemError
  }

  // 2. Prepare key rows for batch upsert
  const keyRowRecords = system.keyRows.map((row, index) => ({
    system_id: system.id,
    row_index: index,
    row_data: row,
  }))

  // 3. Upsert in batches (Supabase limit: 1000 rows per request)
  const batchSize = 1000
  let inserted = 0

  for (let i = 0; i < keyRowRecords.length; i += batchSize) {
    const batch = keyRowRecords.slice(i, i + batchSize)

    const { error: upsertError } = await supabase.from('system_key_rows').upsert(batch, {
      onConflict: 'system_id,row_index',
    })

    if (upsertError) {
      console.error(`   ❌ Failed to upsert batch at offset ${i}:`, upsertError.message)
      throw upsertError
    }

    inserted += batch.length

    if (keyRowRecords.length > batchSize) {
      process.stdout.write(`   Progress: ${inserted}/${keyRowRecords.length}\r`)
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`   ✅ Upserted ${inserted} rows in ${duration}s`)
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Supabase Migration Tool')
  console.log('═'.repeat(60))

  // Step 1: Ensure tables exist
  await ensureTables()

  // Step 2: Load systems
  console.log('\n📂 Loading systems...')
  const systems = loadSystems()
  console.log(`   Found ${systems.length} systems to migrate`)

  // Step 3: Migrate each system
  console.log('\n🔄 Starting migration...')

  let successCount = 0
  let failCount = 0

  for (const system of systems) {
    try {
      await migrateSystem(system)
      successCount++
    } catch (error) {
      console.error(`❌ Failed to migrate ${system.id}:`, error)
      failCount++
    }
  }

  // Step 4: Summary
  console.log('\n' + '═'.repeat(60))
  console.log('📊 Migration Summary')
  console.log('─'.repeat(60))
  console.log(`✅ Successfully migrated: ${successCount}`)
  console.log(`❌ Failed: ${failCount}`)
  console.log(`📦 Total systems: ${systems.length}`)

  // Step 5: Verify
  console.log('\n🔍 Verifying migration...')

  const { count: systemsCount } = await supabase
    .from('betting_systems')
    .select('*', { count: 'exact', head: true })

  const { count: rowsCount } = await supabase
    .from('system_key_rows')
    .select('*', { count: 'exact', head: true })

  console.log(`   Systems in database: ${systemsCount}`)
  console.log(`   Total key rows in database: ${rowsCount}`)

  // Calculate expected total rows
  const expectedRows = systems.reduce((sum, s) => sum + s.keyRows.length, 0)
  console.log(`   Expected total rows: ${expectedRows}`)

  if (rowsCount === expectedRows) {
    console.log('\n✅ Migration completed successfully!')
  } else {
    console.log('\n⚠️  Row count mismatch - please verify manually')
  }

  console.log('═'.repeat(60))
}

// Run migration
main().catch(error => {
  console.error('\n❌ Migration failed:', error)
  process.exit(1)
})
