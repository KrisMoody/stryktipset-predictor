import Bugsnag from '@bugsnag/js'
import type { Event as BugsnagEvent } from '@bugsnag/js'

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogContext {
  [key: string]: unknown
}

/**
 * Check if Bugsnag is initialized
 */
function isBugsnagReady(): boolean {
  try {
    return Bugsnag.isStarted()
  } catch {
    return false
  }
}

class Logger {
  private serviceName: string

  constructor(serviceName: string) {
    this.serviceName = serviceName
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` | ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] [${this.serviceName}] ${message}${contextStr}`
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage(LogLevel.INFO, message, context))
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, context))

    // Report warnings to Bugsnag as well (with warning severity)
    if (isBugsnagReady()) {
      Bugsnag.notify(new Error(message), (event: BugsnagEvent) => {
        event.severity = 'warning'
        event.context = this.serviceName
        if (context) {
          event.addMetadata('logger', context)
        }
      })
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
    }
    console.error(this.formatMessage(LogLevel.ERROR, message, errorContext))

    // Report errors to Bugsnag
    if (isBugsnagReady() && error) {
      const errorObj = error instanceof Error ? error : new Error(message)

      Bugsnag.notify(errorObj, (event: BugsnagEvent) => {
        event.context = this.serviceName

        if (context) {
          event.addMetadata('logger', context)
        }

        // Set severity based on error patterns
        const errorMessage = errorObj.message.toLowerCase()
        if (
          errorMessage.includes('rate limit') ||
          errorMessage.includes('429') ||
          errorMessage.includes('too many requests')
        ) {
          event.severity = 'warning'
        } else if (
          errorMessage.includes('circuit breaker') ||
          errorMessage.includes('temporarily unavailable')
        ) {
          event.severity = 'warning'
        }
      })
    }
  }
}

export function createLogger(serviceName: string): Logger {
  return new Logger(serviceName)
}
