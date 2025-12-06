import { prisma } from '../server/utils/prisma'

interface CheckResult {
  name: string
  passed: boolean
  message: string
  details?: unknown
}

async function verifyAIUsageTable() {
  console.log('='.repeat(60))
  console.log('AI Usage Table Verification Script')
  console.log('='.repeat(60))
  console.log()

  const results: CheckResult[] = []

  // Check 1: Database connection
  console.log('Check 1: Database Connection')
  try {
    await prisma.$queryRaw`SELECT 1`
    results.push({
      name: 'Database Connection',
      passed: true,
      message: 'Successfully connected to database',
    })
    console.log('✓ Database connection successful')
  } catch (error) {
    results.push({
      name: 'Database Connection',
      passed: false,
      message: error instanceof Error ? error.message : String(error),
    })
    console.log('✗ Database connection failed:', error)
    return printSummary(results)
  }
  console.log()

  // Check 2: ai_usage table exists
  console.log('Check 2: AI Usage Table Exists')
  try {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM ai_usage
    `
    const count = Number(result[0]?.count ?? 0)
    results.push({
      name: 'AI Usage Table Exists',
      passed: true,
      message: 'ai_usage table exists and is accessible',
      details: { recordCount: count },
    })
    console.log(`✓ ai_usage table exists (${count} records)`)
  } catch (error) {
    results.push({
      name: 'AI Usage Table Exists',
      passed: false,
      message: error instanceof Error ? error.message : String(error),
    })
    console.log('✗ ai_usage table does not exist or is not accessible:', error)
    return printSummary(results)
  }
  console.log()

  // Check 3: Table indexes
  console.log('Check 3: Table Indexes')
  try {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'ai_usage'
    `
    const indexNames = indexes.map(i => i.indexname)
    const expectedIndexes = [
      'ai_usage_pkey',
      'ai_usage_timestamp_idx',
      'ai_usage_data_type_idx',
      'ai_usage_model_idx',
      'ai_usage_operation_id_idx',
    ]
    const missingIndexes = expectedIndexes.filter(idx => !indexNames.includes(idx))

    if (missingIndexes.length === 0) {
      results.push({
        name: 'Table Indexes',
        passed: true,
        message: 'All expected indexes exist',
        details: { indexes: indexNames },
      })
      console.log('✓ All expected indexes exist')
      console.log(`  Found indexes: ${indexNames.join(', ')}`)
    } else {
      results.push({
        name: 'Table Indexes',
        passed: false,
        message: 'Some indexes are missing',
        details: { missingIndexes, foundIndexes: indexNames },
      })
      console.log('⚠ Some indexes are missing:')
      console.log(`  Missing: ${missingIndexes.join(', ')}`)
      console.log(`  Found: ${indexNames.join(', ')}`)
    }
  } catch (error) {
    results.push({
      name: 'Table Indexes',
      passed: false,
      message: error instanceof Error ? error.message : String(error),
    })
    console.log('✗ Failed to check indexes:', error)
  }
  console.log()

  // Check 4: Write permissions
  console.log('Check 4: Write Permissions')
  const testData = {
    model: 'test-model-verify-script',
    input_tokens: 1,
    output_tokens: 1,
    cost_usd: 0.000001,
    data_type: 'test',
    operation_id: `verify-${Date.now()}`,
    endpoint: 'test',
    duration_ms: 1,
    success: true,
    timestamp: new Date(),
  }

  let testRecordId: number | null = null
  try {
    const record = await prisma.ai_usage.create({ data: testData })
    testRecordId = record.id
    results.push({
      name: 'Write Permissions',
      passed: true,
      message: 'Successfully wrote test record to ai_usage table',
      details: { testRecordId },
    })
    console.log(`✓ Successfully wrote test record (id: ${testRecordId})`)
  } catch (error) {
    results.push({
      name: 'Write Permissions',
      passed: false,
      message: error instanceof Error ? error.message : String(error),
    })
    console.log('✗ Failed to write test record:', error)
    return printSummary(results)
  }
  console.log()

  // Check 5: Read permissions
  console.log('Check 5: Read Permissions')
  try {
    const record = await prisma.ai_usage.findUnique({ where: { id: testRecordId! } })
    if (record) {
      results.push({
        name: 'Read Permissions',
        passed: true,
        message: 'Successfully read test record from ai_usage table',
      })
      console.log('✓ Successfully read test record')
    } else {
      results.push({
        name: 'Read Permissions',
        passed: false,
        message: 'Record was written but could not be read back',
      })
      console.log('✗ Record was written but could not be read back')
    }
  } catch (error) {
    results.push({
      name: 'Read Permissions',
      passed: false,
      message: error instanceof Error ? error.message : String(error),
    })
    console.log('✗ Failed to read test record:', error)
  }
  console.log()

  // Cleanup: Delete test record
  console.log('Cleanup: Deleting Test Record')
  try {
    await prisma.ai_usage.delete({ where: { id: testRecordId! } })
    console.log('✓ Test record deleted')
  } catch (error) {
    console.log('⚠ Failed to delete test record (non-critical):', error)
  }
  console.log()

  printSummary(results)
}

function printSummary(results: CheckResult[]) {
  console.log('='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  console.log()

  const passed = results.filter(r => r.passed).length
  const total = results.length

  results.forEach(result => {
    const icon = result.passed ? '✓' : '✗'
    console.log(`${icon} ${result.name}: ${result.message}`)
  })

  console.log()
  console.log(`Total: ${passed}/${total} checks passed`)

  if (passed === total) {
    console.log()
    console.log('✓ All checks passed! AI usage table is properly configured.')
    process.exit(0)
  } else {
    console.log()
    console.log('✗ Some checks failed. Please review the errors above.')
    process.exit(1)
  }
}

// Run verification
verifyAIUsageTable().catch(error => {
  console.error('Fatal error during verification:', error)
  process.exit(1)
})
