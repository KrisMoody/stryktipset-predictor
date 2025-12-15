/**
 * Script to pre-compute key rows for all betting systems
 *
 * This generates the key rows using the covering code algorithm and saves them
 * to a JSON file that can be bundled with the application for instant lookups.
 *
 * Usage: npx tsx scripts/precompute-key-rows.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Optimization Configuration
const CONFIG = {
  // Skip systems larger than this (use full system instead)
  MAX_FULL_SYSTEM_SIZE: 100000,
  // Use fast heuristic for systems larger than this
  FAST_HEURISTIC_THRESHOLD: 30000,
  // Sample size for candidate selection in fast mode
  CANDIDATE_SAMPLE_SIZE: 2000,
  // Output strategy: 'single' or 'per-system'
  OUTPUT_STRATEGY: 'per-system' as 'single' | 'per-system',
  // Output directory for per-system files
  OUTPUT_DIR: path.join(__dirname, '../server/constants/keyrows'),
  // Skip already processed systems
  SKIP_EXISTING: true,
}

interface BettingSystem {
  id: string
  type: 'R' | 'U'
  helgarderingar: number
  halvgarderingar: number
  rows: number
  guarantee?: number
  keyRows?: number[][]
}

interface BettingSystemsFile {
  'R-systems': BettingSystem[]
  'U-systems': BettingSystem[]
}

/**
 * Generate full mathematical system (3^helg × 2^halvg combinations)
 */
function generateFullSystem(helg: number, halvg: number): number[][] {
  const fullSystem: number[][] = []
  const totalCombinations = Math.pow(3, helg) * Math.pow(2, halvg)

  for (let i = 0; i < totalCombinations; i++) {
    const row: number[] = []
    let remaining = i

    // Generate helgarderingar positions (ternary: 0, 1, 2)
    for (let j = 0; j < helg; j++) {
      row.push(remaining % 3)
      remaining = Math.floor(remaining / 3)
    }

    // Generate halvgarderingar positions (binary: 0, 1)
    for (let j = 0; j < halvg; j++) {
      row.push(remaining % 2)
      remaining = Math.floor(remaining / 2)
    }

    fullSystem.push(row)
  }

  return fullSystem
}

/**
 * Calculate Hamming distance between two rows
 */
function hammingDistance(row1: number[], row2: number[]): number {
  let distance = 0
  for (let i = 0; i < row1.length; i++) {
    if (row1[i] !== row2[i]) {
      distance++
    }
  }
  return distance
}

/**
 * Covering code reduction algorithm using greedy selection
 * Optimized version with progress reporting
 */
function coveringCodeReduction(
  fullSystem: number[][],
  targetRows: number,
  guarantee: number,
  _systemId: string
): number[][] {
  if (fullSystem.length <= targetRows) {
    return fullSystem
  }

  const keyRows: number[][] = []
  const uncoveredRows = new Set<number>(fullSystem.map((_, idx) => idx))
  const radius = 13 - guarantee

  console.log(
    `  Computing ${targetRows} key rows from ${fullSystem.length.toLocaleString()} combinations (radius=${radius})...`
  )

  let lastProgress = 0
  const startTime = Date.now()

  // Greedy selection: pick rows that cover the most uncovered combinations
  while (keyRows.length < targetRows && uncoveredRows.size > 0) {
    let bestRow: number[] | null = null
    let bestCoverage = 0

    for (const idx of uncoveredRows) {
      const row = fullSystem[idx]!
      let coverage = 0

      for (const otherIdx of uncoveredRows) {
        if (hammingDistance(row, fullSystem[otherIdx]!) <= radius) {
          coverage++
        }
      }

      if (coverage > bestCoverage) {
        bestCoverage = coverage
        bestRow = row
      }
    }

    if (bestRow === null) break

    keyRows.push(bestRow)

    // Mark covered rows
    const toRemove: number[] = []
    for (const idx of uncoveredRows) {
      if (hammingDistance(bestRow, fullSystem[idx]!) <= radius) {
        toRemove.push(idx)
      }
    }
    toRemove.forEach(idx => uncoveredRows.delete(idx))

    // Progress reporting
    const progress = Math.floor((keyRows.length / targetRows) * 100)
    if (progress >= lastProgress + 10) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`    ${progress}% complete (${keyRows.length}/${targetRows} rows, ${elapsed}s)`)
      lastProgress = progress
    }
  }

  // If coverage is complete but we need more rows, check if we should use full system
  // This happens when the radius is large enough that few rows cover everything
  if (keyRows.length < targetRows) {
    const needed = targetRows - keyRows.length

    // If full system is small enough, just use it
    if (fullSystem.length <= targetRows * 2) {
      console.log(
        `  ℹ️  Coverage complete with ${keyRows.length} rows, but full system is small (${fullSystem.length})`
      )
      console.log(`  Using full system instead of covering code`)
      return fullSystem
    }

    // Otherwise, sample evenly distributed rows from full system
    console.log(
      `  ℹ️  Coverage complete with ${keyRows.length} rows, adding ${needed} evenly-distributed rows to meet target`
    )

    // Calculate step size to evenly sample across full system
    const existingRows = new Set(keyRows.map(r => r.join(',')))
    const availableRows = fullSystem.filter(r => !existingRows.has(r.join(',')))
    const step = Math.floor(availableRows.length / needed)

    for (let i = 0; i < needed && i * step < availableRows.length; i++) {
      keyRows.push(availableRows[i * step]!)
    }
  }

  // Final validation
  if (keyRows.length < targetRows) {
    throw new Error(
      `Failed to generate enough key rows! Got ${keyRows.length}/${targetRows}. ` +
        `Full system only has ${fullSystem.length} combinations. ` +
        `System specification may be invalid.`
    )
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`  ✓ Generated ${keyRows.length} key rows in ${totalTime}s`)

  return keyRows
}

/**
 * Fast heuristic covering code reduction - samples candidates instead of checking all
 * Much faster for large systems with acceptable quality
 */
function coveringCodeReductionFast(
  fullSystem: number[][],
  targetRows: number,
  guarantee: number,
  _systemId: string
): number[][] {
  if (fullSystem.length <= targetRows) {
    return fullSystem
  }

  const keyRows: number[][] = []
  const uncoveredRows = new Set<number>(fullSystem.map((_, idx) => idx))
  const radius = 13 - guarantee

  console.log(
    `  Computing ${targetRows} key rows from ${fullSystem.length.toLocaleString()} combinations (radius=${radius}, FAST mode)...`
  )

  let lastProgress = 0
  const startTime = Date.now()

  // Greedy selection with sampling
  while (keyRows.length < targetRows && uncoveredRows.size > 0) {
    let bestRow: number[] | null = null
    let bestCoverage = 0

    // Sample candidates instead of checking all
    const candidates = Array.from(uncoveredRows)
    const sampleSize = Math.min(CONFIG.CANDIDATE_SAMPLE_SIZE, candidates.length)
    const sampledIndices = new Set<number>()

    // Random sampling without replacement
    while (sampledIndices.size < sampleSize) {
      const randomIdx = Math.floor(Math.random() * candidates.length)
      sampledIndices.add(candidates[randomIdx]!)
    }

    for (const idx of sampledIndices) {
      const row = fullSystem[idx]!
      let coverage = 0

      // Count coverage (check all uncovered, not sampled)
      for (const otherIdx of uncoveredRows) {
        if (hammingDistance(row, fullSystem[otherIdx]!) <= radius) {
          coverage++
        }
      }

      if (coverage > bestCoverage) {
        bestCoverage = coverage
        bestRow = row
      }
    }

    if (bestRow === null) {
      // Fallback: pick any uncovered row
      const idx = Array.from(uncoveredRows)[0]!
      bestRow = fullSystem[idx]!
    }

    keyRows.push(bestRow)

    // Mark covered rows
    const toRemove: number[] = []
    for (const idx of uncoveredRows) {
      if (hammingDistance(bestRow, fullSystem[idx]!) <= radius) {
        toRemove.push(idx)
      }
    }
    toRemove.forEach(idx => uncoveredRows.delete(idx))

    // Progress reporting
    const progress = Math.floor((keyRows.length / targetRows) * 100)
    if (progress >= lastProgress + 10) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const rate = ((keyRows.length / (Date.now() - startTime)) * 1000).toFixed(1)
      console.log(
        `    ${progress}% complete (${keyRows.length}/${targetRows} rows, ${elapsed}s, ${rate} rows/s)`
      )
      lastProgress = progress
    }
  }

  // If coverage is complete but we need more rows, check if we should use full system
  // This happens when the radius is large enough that few rows cover everything
  if (keyRows.length < targetRows) {
    const needed = targetRows - keyRows.length

    // If full system is small enough, just use it
    if (fullSystem.length <= targetRows * 2) {
      console.log(
        `  ℹ️  Coverage complete with ${keyRows.length} rows, but full system is small (${fullSystem.length})`
      )
      console.log(`  Using full system instead of covering code`)
      return fullSystem
    }

    // Otherwise, sample evenly distributed rows from full system
    console.log(
      `  ℹ️  Coverage complete with ${keyRows.length} rows, adding ${needed} evenly-distributed rows to meet target`
    )

    // Calculate step size to evenly sample across full system
    const existingRows = new Set(keyRows.map(r => r.join(',')))
    const availableRows = fullSystem.filter(r => !existingRows.has(r.join(',')))
    const step = Math.floor(availableRows.length / needed)

    for (let i = 0; i < needed && i * step < availableRows.length; i++) {
      keyRows.push(availableRows[i * step]!)
    }
  }

  // Final validation
  if (keyRows.length < targetRows) {
    throw new Error(
      `Failed to generate enough key rows in FAST mode! Got ${keyRows.length}/${targetRows}. ` +
        `Full system only has ${fullSystem.length} combinations. ` +
        `System specification may be invalid.`
    )
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  const rate = ((keyRows.length / (Date.now() - startTime)) * 1000).toFixed(1)
  console.log(`  ✓ Generated ${keyRows.length} key rows in ${totalTime}s (${rate} rows/s)`)

  return keyRows
}

/**
 * Save system to individual file
 */
function saveSystemFile(system: BettingSystem): void {
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true })
  }
  const filename = path.join(CONFIG.OUTPUT_DIR, `${system.id}.json`)
  fs.writeFileSync(filename, JSON.stringify(system, null, 2))
}

/**
 * Load system from individual file if it exists
 */
function loadSystemFile(systemId: string): BettingSystem | null {
  const filename = path.join(CONFIG.OUTPUT_DIR, `${systemId}.json`)
  if (fs.existsSync(filename)) {
    return JSON.parse(fs.readFileSync(filename, 'utf-8'))
  }
  return null
}

/**
 * Process all systems and generate key rows
 */
async function main() {
  const inputPath = path.join(__dirname, '../server/constants/betting-systems.json')
  const outputPath = path.join(__dirname, '../server/constants/betting-systems-with-keyrows.json')

  console.log('Loading betting systems...')
  const systemsFile: BettingSystemsFile = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))

  const allSystems = [...systemsFile['R-systems'], ...systemsFile['U-systems']]
  console.log(`Found ${allSystems.length} systems to process`)
  console.log(`\nConfiguration:`)
  console.log(`  Output strategy: ${CONFIG.OUTPUT_STRATEGY}`)
  console.log(`  Skip existing: ${CONFIG.SKIP_EXISTING}`)
  console.log(`  Max full system size: ${CONFIG.MAX_FULL_SYSTEM_SIZE.toLocaleString()}`)
  console.log(`  Fast heuristic threshold: ${CONFIG.FAST_HEURISTIC_THRESHOLD.toLocaleString()}`)
  console.log(`  Candidate sample size: ${CONFIG.CANDIDATE_SAMPLE_SIZE.toLocaleString()}\n`)

  // Sort by complexity (smaller systems first for faster feedback)
  const sortedSystems = [...allSystems].sort((a, b) => {
    const sizeA = Math.pow(3, a.helgarderingar) * Math.pow(2, a.halvgarderingar)
    const sizeB = Math.pow(3, b.helgarderingar) * Math.pow(2, b.halvgarderingar)
    return sizeA - sizeB
  })

  const processedSystems: Map<string, BettingSystem> = new Map()
  let skippedCount = 0
  let largeSystemCount = 0
  let fastModeCount = 0
  let fullModeCount = 0

  for (const system of sortedSystems) {
    const fullSize = Math.pow(3, system.helgarderingar) * Math.pow(2, system.halvgarderingar)

    // Check if already processed
    if (CONFIG.SKIP_EXISTING && CONFIG.OUTPUT_STRATEGY === 'per-system') {
      const existing = loadSystemFile(system.id)
      if (existing?.keyRows) {
        console.log(`\nSkipping ${system.id} (already processed)`)
        processedSystems.set(system.id, existing)
        skippedCount++
        continue
      }
    }

    console.log(`\nProcessing ${system.id}:`)
    console.log(`  Full system size: ${fullSize.toLocaleString()} combinations`)
    console.log(`  Target rows: ${system.rows}`)

    let keyRows: number[][]

    // Strategy 1: Skip very large systems (use full system)
    if (fullSize > CONFIG.MAX_FULL_SYSTEM_SIZE) {
      console.log(
        `  ⚠️  System too large (>${CONFIG.MAX_FULL_SYSTEM_SIZE.toLocaleString()}), using full system`
      )
      const fullSystem = generateFullSystem(system.helgarderingar, system.halvgarderingar)
      keyRows = fullSystem
      largeSystemCount++
    }
    // Strategy 2: Use fast heuristic for medium-large systems
    else if (fullSize > CONFIG.FAST_HEURISTIC_THRESHOLD) {
      const fullSystem = generateFullSystem(system.helgarderingar, system.halvgarderingar)
      if (fullSystem.length === system.rows) {
        console.log('  No reduction needed (full system)')
        keyRows = fullSystem
      } else {
        keyRows = coveringCodeReductionFast(
          fullSystem,
          system.rows,
          system.guarantee || 10,
          system.id
        )
        fastModeCount++
      }
    }
    // Strategy 3: Use full greedy algorithm for small systems
    else {
      const fullSystem = generateFullSystem(system.helgarderingar, system.halvgarderingar)
      if (fullSystem.length === system.rows) {
        console.log('  No reduction needed (full system)')
        keyRows = fullSystem
      } else {
        keyRows = coveringCodeReduction(fullSystem, system.rows, system.guarantee || 10, system.id)
        fullModeCount++
      }
    }

    const processedSystem = {
      ...system,
      keyRows,
    }

    processedSystems.set(system.id, processedSystem)

    // Save to individual file if per-system strategy
    if (CONFIG.OUTPUT_STRATEGY === 'per-system') {
      saveSystemFile(processedSystem)
      console.log(`  💾 Saved to ${system.id}.json`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('Processing Summary:')
  console.log(`  Total systems: ${allSystems.length}`)
  console.log(`  Skipped (existing): ${skippedCount}`)
  console.log(`  Large systems (full): ${largeSystemCount}`)
  console.log(`  Fast heuristic: ${fastModeCount}`)
  console.log(`  Full greedy: ${fullModeCount}`)
  console.log('='.repeat(60))

  // Always write combined file (used for final aggregate output)
  // Reconstruct output in original order
  const output: BettingSystemsFile = {
    'R-systems': systemsFile['R-systems'].map(s => processedSystems.get(s.id)!),
    'U-systems': systemsFile['U-systems'].map(s => processedSystems.get(s.id)!),
  }

  console.log(`\n\nWriting combined output to ${outputPath}...`)
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))

  // Calculate file sizes
  const inputSize = fs.statSync(inputPath).size
  const outputSize = fs.statSync(outputPath).size
  console.log(`\nInput file size: ${(inputSize / 1024).toFixed(1)} KB`)
  console.log(`Output file size: ${(outputSize / 1024).toFixed(1)} KB`)
  console.log(`Size increase: ${((outputSize / inputSize - 1) * 100).toFixed(0)}%`)

  console.log('\n✅ Done! Key rows have been pre-computed for all systems.')
  console.log(
    '\nNext steps:\n' +
      '1. Review the output files\n' +
      '2. For combined file: Rename betting-systems-with-keyrows.json to betting-systems.json\n' +
      '3. For per-system files: Update SystemGenerator to load from keyrows/ directory\n' +
      '4. Consider storing in database for faster access'
  )
}

main().catch(console.error)
