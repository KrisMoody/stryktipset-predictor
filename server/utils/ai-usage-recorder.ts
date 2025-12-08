import { prisma } from './prisma'
import { createLogger } from './logger'
import { validateAIUsageData, sanitizeAIUsageData, type AIUsageData } from './ai-usage-validator'
import { aiUsageMetrics } from './ai-usage-metrics'
import { failedWritesQueue } from './failed-writes-queue'

const logger = createLogger('AIUsageRecorder')

interface RecorderOptions {
  maxRetries?: number
  retryDelayMs?: number
  sanitizeOnValidationFailure?: boolean
}

const defaultOptions: Required<RecorderOptions> = {
  maxRetries: 3,
  retryDelayMs: 1000,
  sanitizeOnValidationFailure: true,
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function recordAIUsage(
  data: AIUsageData,
  options: RecorderOptions = {}
): Promise<void> {
  const opts = { ...defaultOptions, ...options }

  aiUsageMetrics.recordAttempt()

  // Validate data
  const validation = validateAIUsageData(data)
  if (!validation.valid) {
    aiUsageMetrics.recordValidationFailure()
    logger.error('AI usage data validation failed', undefined, {
      errors: validation.errors,
      data,
    })

    if (opts.sanitizeOnValidationFailure) {
      logger.warn('Attempting to sanitize and retry with cleaned data')
      const sanitized = sanitizeAIUsageData(data)
      return recordAIUsage(sanitized, { ...opts, sanitizeOnValidationFailure: false })
    } else {
      const errorMsg = `Validation failed: ${validation.errors.map(e => `${e.field}: ${e.message}`).join(', ')}`
      failedWritesQueue.add(data, errorMsg)
      throw new Error(errorMsg)
    }
  }

  // Attempt write with retries
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      await prisma.ai_usage.create({
        data: {
          user_id: data.userId,
          model: data.model,
          input_tokens: data.inputTokens,
          output_tokens: data.outputTokens,
          cost_usd: data.cost,
          data_type: data.dataType,
          operation_id: data.operationId,
          endpoint: data.endpoint,
          duration_ms: data.duration,
          success: data.success,
          timestamp: new Date(),
        },
      })

      aiUsageMetrics.recordSuccess()

      logger.debug('Successfully recorded AI usage', {
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        cost: data.cost,
        dataType: data.dataType,
        operationId: data.operationId,
        attempt,
      })

      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < opts.maxRetries) {
        aiUsageMetrics.recordRetry()
        const delay = opts.retryDelayMs * Math.pow(2, attempt - 1) // Exponential backoff

        logger.warn(`AI usage recording failed, retrying (${attempt}/${opts.maxRetries})`, {
          error: lastError.message,
          nextRetryIn: `${delay}ms`,
          data,
        })

        await sleep(delay)
      }
    }
  }

  // All retries failed
  const errorMsg = `Failed to record AI usage after ${opts.maxRetries} attempts: ${lastError?.message}`
  aiUsageMetrics.recordFailure(lastError?.name || 'UnknownError', errorMsg, {
    data,
    lastError: lastError?.stack,
  })

  logger.error('All retry attempts exhausted', lastError, { data, attempts: opts.maxRetries })

  // Add to failed writes queue for later retry
  failedWritesQueue.add(data, errorMsg)

  // Don't throw - we've logged and queued it
}

export async function retryFailedWrites(): Promise<{ succeeded: number; failed: number }> {
  logger.info('Starting manual retry of failed writes')
  return await failedWritesQueue.retryAll(async data => {
    await recordAIUsage(data, { sanitizeOnValidationFailure: false })
  })
}
