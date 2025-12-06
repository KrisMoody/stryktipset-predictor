interface ErrorRecord {
  timestamp: Date
  errorType: string
  errorMessage: string
  context?: unknown
}

interface MetricsData {
  totalAttempts: number
  successfulWrites: number
  failedWrites: number
  retryAttempts: number
  validationFailures: number
  errorsByType: Map<string, number>
  recentErrors: ErrorRecord[]
}

class AIUsageMetricsTracker {
  private metrics: MetricsData
  private readonly maxRecentErrors = 50

  constructor() {
    this.metrics = {
      totalAttempts: 0,
      successfulWrites: 0,
      failedWrites: 0,
      retryAttempts: 0,
      validationFailures: 0,
      errorsByType: new Map(),
      recentErrors: [],
    }
  }

  recordAttempt(): void {
    this.metrics.totalAttempts++
  }

  recordSuccess(): void {
    this.metrics.successfulWrites++
  }

  recordFailure(errorType: string, errorMessage: string, context?: unknown): void {
    this.metrics.failedWrites++

    // Track error by type
    const currentCount = this.metrics.errorsByType.get(errorType) || 0
    this.metrics.errorsByType.set(errorType, currentCount + 1)

    // Add to recent errors
    this.metrics.recentErrors.unshift({
      timestamp: new Date(),
      errorType,
      errorMessage,
      context,
    })

    // Keep only the most recent errors
    if (this.metrics.recentErrors.length > this.maxRecentErrors) {
      this.metrics.recentErrors = this.metrics.recentErrors.slice(0, this.maxRecentErrors)
    }
  }

  recordRetry(): void {
    this.metrics.retryAttempts++
  }

  recordValidationFailure(): void {
    this.metrics.validationFailures++
  }

  getMetrics() {
    const successRate =
      this.metrics.totalAttempts > 0
        ? (this.metrics.successfulWrites / this.metrics.totalAttempts) * 100
        : 0

    return {
      totalAttempts: this.metrics.totalAttempts,
      successfulWrites: this.metrics.successfulWrites,
      failedWrites: this.metrics.failedWrites,
      retryAttempts: this.metrics.retryAttempts,
      validationFailures: this.metrics.validationFailures,
      successRate: successRate.toFixed(2) + '%',
      errorsByType: Object.fromEntries(this.metrics.errorsByType),
      recentErrors: this.metrics.recentErrors.map(err => ({
        timestamp: err.timestamp.toISOString(),
        errorType: err.errorType,
        errorMessage: err.errorMessage,
        context: err.context,
      })),
    }
  }

  reset(): void {
    this.metrics = {
      totalAttempts: 0,
      successfulWrites: 0,
      failedWrites: 0,
      retryAttempts: 0,
      validationFailures: 0,
      errorsByType: new Map(),
      recentErrors: [],
    }
  }
}

export const aiUsageMetrics = new AIUsageMetricsTracker()
