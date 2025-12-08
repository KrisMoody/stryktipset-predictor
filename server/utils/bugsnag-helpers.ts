import Bugsnag from '@bugsnag/js'
import type { Event as BugsnagEvent } from '@bugsnag/js'

/**
 * Check if Bugsnag is initialized and ready
 */
function isBugsnagReady(): boolean {
  try {
    return Bugsnag.isStarted()
  } catch {
    return false
  }
}

export type OperationType =
  | 'scraping'
  | 'prediction'
  | 'api_call'
  | 'scheduled_task'
  | 'database'
  | 'cost_cap'

export interface OperationContext {
  operation: OperationType
  service: string
  metadata?: Record<string, unknown>
}

/**
 * Capture errors with operation-specific context
 */
export function captureOperationError(error: Error | unknown, context: OperationContext): void {
  if (!isBugsnagReady()) return

  const errorObj = error instanceof Error ? error : new Error(String(error))

  Bugsnag.notify(errorObj, (event: BugsnagEvent) => {
    event.context = `${context.operation}:${context.service}`

    // Add operation-specific metadata
    event.addMetadata('operation', {
      type: context.operation,
      service: context.service,
      timestamp: new Date().toISOString(),
    })

    if (context.metadata) {
      event.addMetadata('details', context.metadata)
    }

    // Set severity based on operation type
    if (context.operation === 'scheduled_task') {
      event.severity = 'error' // Always important - background tasks fail silently
    } else if (context.operation === 'scraping') {
      // Check if rate limit error (less severe)
      if (
        errorObj.message.includes('rate limit') ||
        errorObj.message.includes('429') ||
        errorObj.message.includes('Too Many Requests')
      ) {
        event.severity = 'warning'
      }
    } else if (context.operation === 'cost_cap') {
      // Cost cap exceeded is expected flow, not a true error
      if (errorObj.message.includes('exceeded') || errorObj.message.includes('budget')) {
        event.severity = 'info'
      }
    }
  })
}

export interface AIErrorContext {
  model: string
  operation: string
  inputTokens?: number
  outputTokens?: number
  cost?: number
  dataType?: string
  matchId?: number
}

/**
 * Capture AI operation errors with token and cost context
 */
export function captureAIError(error: Error | unknown, context: AIErrorContext): void {
  if (!isBugsnagReady()) return

  const errorObj = error instanceof Error ? error : new Error(String(error))

  Bugsnag.notify(errorObj, (event: BugsnagEvent) => {
    event.context = `ai:${context.operation}`
    event.severity = 'error' // AI errors are usually high priority (expensive)

    event.addMetadata('ai', {
      model: context.model,
      operation: context.operation,
      dataType: context.dataType,
      matchId: context.matchId,
    })

    if (context.inputTokens !== undefined || context.cost !== undefined) {
      event.addMetadata('tokens', {
        input: context.inputTokens,
        output: context.outputTokens,
        cost: context.cost,
      })
    }

    // Check for rate limit errors
    if (
      errorObj.message.includes('rate_limit') ||
      errorObj.message.includes('429') ||
      errorObj.message.includes('overloaded')
    ) {
      event.severity = 'warning'
    }
  })
}

export interface ScrapingErrorContext {
  matchId: number
  dataType: string
  method: 'ai' | 'tab_clicking' | 'unknown'
  url?: string
  duration?: number
}

/**
 * Capture scraping errors with match context
 */
export function captureScrapingError(error: Error | unknown, context: ScrapingErrorContext): void {
  const errorObj = error instanceof Error ? error : new Error(String(error))

  captureOperationError(errorObj, {
    operation: 'scraping',
    service: 'scraper-v3',
    metadata: {
      matchId: context.matchId,
      dataType: context.dataType,
      method: context.method,
      url: context.url,
      duration: context.duration,
    },
  })
}

export interface DatabaseErrorContext {
  operation: string
  table?: string
  retryCount?: number
  data?: Record<string, unknown>
}

/**
 * Capture database operation errors
 */
export function captureDatabaseError(error: Error | unknown, context: DatabaseErrorContext): void {
  if (!isBugsnagReady()) return

  const errorObj = error instanceof Error ? error : new Error(String(error))

  Bugsnag.notify(errorObj, (event: BugsnagEvent) => {
    event.context = `database:${context.operation}`

    // Database errors with retry mechanism are less severe
    if (context.retryCount !== undefined && context.retryCount > 0) {
      event.severity = 'warning'
    } else {
      event.severity = 'error'
    }

    event.addMetadata('database', {
      operation: context.operation,
      table: context.table,
      retryCount: context.retryCount,
    })

    if (context.data) {
      // Only include non-sensitive data summaries
      event.addMetadata('data', {
        ...context.data,
      })
    }
  })
}

/**
 * Set user context for subsequent error reports
 */
export function setUserContext(
  userId: string,
  email?: string,
  metadata?: Record<string, unknown>
): void {
  if (!isBugsnagReady()) return

  Bugsnag.setUser(userId, email)

  if (metadata) {
    Bugsnag.addMetadata('user', metadata)
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  metadata?: Record<string, unknown>,
  type:
    | 'navigation'
    | 'request'
    | 'process'
    | 'log'
    | 'user'
    | 'state'
    | 'error'
    | 'manual' = 'manual'
): void {
  if (!isBugsnagReady()) return

  Bugsnag.leaveBreadcrumb(message, metadata, type)
}
