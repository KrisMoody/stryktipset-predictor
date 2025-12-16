/**
 * EASIEST APPROACH: Generate SQL file for direct import
 *
 * This generates a .sql file you can simply copy-paste into Supabase SQL Editor
 * No scripts to run, no environment variables needed!
 *
 * Usage:
 * 1. Run: npx tsx scripts/generate-migration-sql.ts
 * 2. Copy the contents of generated-migration.sql
 * 3. Paste into Supabase SQL Editor
 * 4. Click "Run"
 * 5. Done! ✅
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface BettingSystem {
  id: string
  type: 'R' | 'U'
  helgarderingar: number
  halvgarderingar: number
  rows: number
  guarantee?: number
  keyRows: number[][]
}

function escapeSql(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'

  // Escape single quotes by doubling them
  return `'${String(value).replace(/'/g, "''")}'`
}

function generateSql(): string {
  // Load systems
  const inputPath = path.join(__dirname, '../server/constants/betting-systems-with-keyrows.json')

  if (!fs.existsSync(inputPath)) {
    console.error('❌ File not found:', inputPath)
    console.error('Please run the precompute script first!')
    process.exit(1)
  }

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
  const systems: BettingSystem[] = [...data['R-systems'], ...data['U-systems']]

  console.log(`Found ${systems.length} systems`)

  let sql = `-- Stryktipset Key Rows Migration
-- Generated: ${new Date().toISOString()}
-- Total systems: ${systems.length}

-- Step 1: Create tables
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

-- Step 2: Enable Row Level Security (optional - adjust policies as needed)
ALTER TABLE betting_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_key_rows ENABLE ROW LEVEL SECURITY;

-- Public read access policies
DROP POLICY IF EXISTS "Allow public read" ON betting_systems;
CREATE POLICY "Allow public read" ON betting_systems FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read" ON system_key_rows;
CREATE POLICY "Allow public read" ON system_key_rows FOR SELECT USING (true);

-- Step 3: Clear existing data (if re-running)
TRUNCATE TABLE system_key_rows;
TRUNCATE TABLE betting_systems CASCADE;

-- Step 4: Insert system metadata
INSERT INTO betting_systems (id, type, helgarderingar, halvgarderingar, rows, guarantee) VALUES\n`

  // Add system metadata
  const systemValues = systems.map(
    system =>
      `  (${escapeSql(system.id)}, ${escapeSql(system.type)}, ${system.helgarderingar}, ${system.halvgarderingar}, ${system.rows}, ${system.guarantee || 'NULL'})`
  )

  sql += systemValues.join(',\n') + ';\n\n'

  // Add key rows
  sql += '-- Step 5: Insert key rows\n'

  let totalRows = 0
  for (const system of systems) {
    sql += `\n-- System: ${system.id} (${system.keyRows.length} rows)\n`
    sql += `INSERT INTO system_key_rows (system_id, row_index, row_data) VALUES\n`

    const rowValues = system.keyRows.map((row, index) => {
      totalRows++
      const jsonRow = JSON.stringify(row)
      return `  (${escapeSql(system.id)}, ${index}, '${jsonRow}'::jsonb)`
    })

    sql += rowValues.join(',\n') + ';\n'
  }

  sql += `\n-- Migration complete!
-- Total systems: ${systems.length}
-- Total key rows: ${totalRows}
-- Database size: ~2 MB\n`

  console.log(`Generated SQL with ${totalRows} total rows`)

  return sql
}

// Generate and save
const sql = generateSql()
const outputPath = path.join(__dirname, 'generated-migration.sql')
fs.writeFileSync(outputPath, sql)

console.log(`\n✅ SQL file generated: ${outputPath}`)
console.log('\nNext steps:')
console.log('1. Open the file: cat scripts/generated-migration.sql')
console.log('2. Copy all contents')
console.log('3. Go to Supabase Dashboard → SQL Editor')
console.log('4. Paste and click "Run"')
console.log('5. Done! 🎉')
