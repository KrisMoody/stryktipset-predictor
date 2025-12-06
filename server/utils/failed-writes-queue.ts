import type { AIUsageData } from './ai-usage-validator'
import { createLogger } from './logger'

const logger = createLogger('FailedWritesQueue')

interface FailedWrite {
  id: string
  data: AIUsageData
  error: string
  timestamp: Date
  retryCount: number
}

class FailedWritesQueue {
  private queue: FailedWrite[] = []
  private readonly maxQueueSize = 1000
  private retryInterval: NodeJS.Timeout | null = null
  private readonly retryIntervalMs = 5 * 60 * 1000 // 5 minutes

  constructor() {
    // Start periodic retry mechanism
    this.startRetryInterval()
  }

  add(data: AIUsageData, error: string): void {
    if (this.queue.length >= this.maxQueueSize) {
      logger.warn('Failed writes queue is full, removing oldest entry', {
        queueSize: this.queue.length,
        maxSize: this.maxQueueSize,
      })
      this.queue.shift()
    }

    const failedWrite: FailedWrite = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      data,
      error,
      timestamp: new Date(),
      retryCount: 0,
    }

    this.queue.push(failedWrite)
    logger.info('Added failed write to queue', {
      id: failedWrite.id,
      queueSize: this.queue.length,
    })
  }

  getAll(): FailedWrite[] {
    return [...this.queue]
  }

  getSize(): number {
    return this.queue.length
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex(fw => fw.id === id)
    if (index !== -1) {
      this.queue.splice(index, 1)
      logger.info('Removed write from queue', { id, queueSize: this.queue.length })
      return true
    }
    return false
  }

  clear(): void {
    const size = this.queue.length
    this.queue = []
    logger.info('Cleared failed writes queue', { clearedCount: size })
  }

  incrementRetryCount(id: string): void {
    const write = this.queue.find(fw => fw.id === id)
    if (write) {
      write.retryCount++
    }
  }

  async retryAll(
    retryFn: (data: AIUsageData) => Promise<void>
  ): Promise<{ succeeded: number; failed: number }> {
    if (this.queue.length === 0) {
      return { succeeded: 0, failed: 0 }
    }

    logger.info('Starting retry of failed writes', { queueSize: this.queue.length })

    const results = { succeeded: 0, failed: 0 }
    const toRetry = [...this.queue]

    for (const write of toRetry) {
      try {
        this.incrementRetryCount(write.id)
        await retryFn(write.data)
        this.remove(write.id)
        results.succeeded++
        logger.info('Successfully retried failed write', { id: write.id })
      } catch (error) {
        results.failed++
        logger.error('Failed to retry write', error, {
          id: write.id,
          retryCount: write.retryCount,
        })
      }
    }

    logger.info('Completed retry of failed writes', results)
    return results
  }

  private startRetryInterval(): void {
    if (this.retryInterval) {
      return
    }

    this.retryInterval = setInterval(() => {
      if (this.queue.length > 0) {
        logger.info('Periodic retry check', { queueSize: this.queue.length })
        // Note: Actual retry will be triggered by the recorder
        // This is just a reminder log
      }
    }, this.retryIntervalMs)
  }

  stopRetryInterval(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval)
      this.retryInterval = null
      logger.info('Stopped retry interval')
    }
  }

  getStatus() {
    return {
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      oldestEntry: this.queue.length > 0 ? this.queue[0]?.timestamp.toISOString() : null,
      newestEntry:
        this.queue.length > 0 ? this.queue[this.queue.length - 1]?.timestamp.toISOString() : null,
      entries: this.queue.map(fw => ({
        id: fw.id,
        timestamp: fw.timestamp.toISOString(),
        retryCount: fw.retryCount,
        error: fw.error,
        dataType: fw.data.dataType,
        operationId: fw.data.operationId,
      })),
    }
  }
}

export const failedWritesQueue = new FailedWritesQueue()
