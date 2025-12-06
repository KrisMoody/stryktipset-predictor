import { prisma } from './prisma'
import { createLogger } from './logger'

const logger = createLogger('TestAIUsageWrite')

export interface TestResult {
  success: boolean
  message: string
  error?: string
  details?: any
}

export async function testAIUsageWrite(): Promise<TestResult> {
  try {
    logger.info('Starting AI usage write test')

    // Test 1: Check database connection
    logger.info('Test 1: Checking database connection')
    try {
      await prisma.$queryRaw`SELECT 1`
      logger.info('✓ Database connection successful')
    }
    catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('✗ Database connection failed', error)
      return {
        success: false,
        message: 'Database connection failed',
        error: errorMsg,
      }
    }

    // Test 2: Check if ai_usage table exists
    logger.info('Test 2: Checking if ai_usage table exists')
    try {
      await prisma.$queryRaw`SELECT COUNT(*) FROM ai_usage LIMIT 1`
      logger.info('✓ ai_usage table exists')
    }
    catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('✗ ai_usage table does not exist or is not accessible', error)
      return {
        success: false,
        message: 'ai_usage table does not exist or is not accessible',
        error: errorMsg,
      }
    }

    // Test 3: Attempt to write test record
    logger.info('Test 3: Attempting to write test record')
    const testData = {
      model: 'test-model',
      input_tokens: 100,
      output_tokens: 50,
      cost_usd: 0.001,
      data_type: 'test',
      operation_id: `test-${Date.now()}`,
      endpoint: 'test.endpoint',
      duration_ms: 1000,
      success: true,
      timestamp: new Date(),
    }

    let createdRecord
    try {
      createdRecord = await prisma.ai_usage.create({
        data: testData,
      })
      logger.info('✓ Test record written successfully', { id: createdRecord.id })
    }
    catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('✗ Failed to write test record', error)
      return {
        success: false,
        message: 'Failed to write test record',
        error: errorMsg,
        details: { testData },
      }
    }

    // Test 4: Verify record can be read back
    logger.info('Test 4: Verifying record can be read back')
    try {
      const readRecord = await prisma.ai_usage.findUnique({
        where: { id: createdRecord.id },
      })

      if (!readRecord) {
        logger.error('✗ Record was written but could not be read back')
        return {
          success: false,
          message: 'Record was written but could not be read back',
          details: { createdId: createdRecord.id },
        }
      }

      logger.info('✓ Record read back successfully', { id: readRecord.id })
    }
    catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('✗ Failed to read back test record', error)
      return {
        success: false,
        message: 'Failed to read back test record',
        error: errorMsg,
        details: { createdId: createdRecord.id },
      }
    }

    // Test 5: Clean up test record
    logger.info('Test 5: Cleaning up test record')
    try {
      await prisma.ai_usage.delete({
        where: { id: createdRecord.id },
      })
      logger.info('✓ Test record deleted successfully')
    }
    catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.warn('⚠ Failed to delete test record (non-critical)', { error: errorMsg, id: createdRecord.id })
    }

    logger.info('All tests passed successfully')
    return {
      success: true,
      message: 'All tests passed: Database connection, table exists, write successful, read successful',
      details: {
        testRecordId: createdRecord.id,
        testData,
      },
    }
  }
  catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error('Unexpected error during test', error)
    return {
      success: false,
      message: 'Unexpected error during test',
      error: errorMsg,
    }
  }
}
