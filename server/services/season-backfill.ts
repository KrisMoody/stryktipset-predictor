import { prisma } from '~/server/utils/prisma'
import { svenskaSpelHistoricApi } from './svenska-spel-historic-api'
import { drawSyncService } from './draw-sync'

/**
 * Options for season backfill operation
 */
export interface SeasonBackfillOptions {
  startDate: Date
  endDate: Date
  batchSize?: number // Default: 15
  skipExisting?: boolean // Default: true
  archiveOnComplete?: boolean // Default: true
  retryAttempts?: number // Default: 3
  progressCallback?: (progress: BackfillProgress) => void
}

/**
 * Progress information for backfill operation
 */
export interface BackfillProgress {
  phase: 'discovery' | 'filtering' | 'processing' | 'archiving' | 'complete'
  totalDraws: number
  processedDraws: number
  successfulDraws: number
  failedDraws: number
  skippedDraws: number
  currentBatch?: number
  totalBatches?: number
  errors: Array<{ drawNumber: number; error: string; retryCount: number }>
}

/**
 * Result of backfill operation
 */
export interface BackfillResult {
  success: boolean
  totalDraws: number
  processedDraws: number
  successfulDraws: number
  failedDraws: number
  skippedDraws: number
  errors: Array<{ drawNumber: number; error: string }>
  duration: number // milliseconds
}

/**
 * Result of batch processing
 */
interface BatchResult {
  successful: number[]
  failed: Array<{ drawNumber: number; error: string }>
}

/**
 * Service for backfilling historic Stryktipset draws
 */
export class SeasonBackfillService {
  private readonly DEFAULT_BATCH_SIZE = 15
  private readonly DEFAULT_RETRY_ATTEMPTS = 3
  private readonly DISCOVERY_DELAY_MS = 500
  private readonly BATCH_DELAY_MS = 2500
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5
  private readonly CIRCUIT_BREAKER_PAUSE_MS = 30000

  private consecutiveFailures = 0
  private isCancelled = false

  /**
   * Main entry point for season backfill
   */
  async backfillSeason(options: SeasonBackfillOptions): Promise<BackfillResult> {
    const startTime = Date.now()
    const {
      startDate,
      endDate,
      batchSize = this.DEFAULT_BATCH_SIZE,
      skipExisting = true,
      retryAttempts = this.DEFAULT_RETRY_ATTEMPTS,
      progressCallback,
    } = options

    console.log('[Season Backfill] Starting backfill operation...')
    console.log(
      `[Season Backfill] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    )
    console.log(`[Season Backfill] Batch size: ${batchSize}, Skip existing: ${skipExisting}`)

    this.isCancelled = false
    this.consecutiveFailures = 0

    const progress: BackfillProgress = {
      phase: 'discovery',
      totalDraws: 0,
      processedDraws: 0,
      successfulDraws: 0,
      failedDraws: 0,
      skippedDraws: 0,
      errors: [],
    }

    try {
      // Phase 1: Discover all draw numbers for date range
      progressCallback?.(progress)
      const allDrawNumbers = await this.discoverDrawNumbers(startDate, endDate)

      if (allDrawNumbers.length === 0) {
        console.warn('[Season Backfill] No draws found for the specified date range')
        progress.phase = 'complete'
        progressCallback?.(progress)
        return {
          success: true,
          totalDraws: 0,
          processedDraws: 0,
          successfulDraws: 0,
          failedDraws: 0,
          skippedDraws: 0,
          errors: [],
          duration: Date.now() - startTime,
        }
      }

      console.log(`[Season Backfill] Discovered ${allDrawNumbers.length} draws`)
      progress.totalDraws = allDrawNumbers.length

      // Phase 2: Filter out existing draws if requested
      progress.phase = 'filtering'
      progressCallback?.(progress)

      const drawsToProcess = skipExisting
        ? await this.filterExistingDraws(allDrawNumbers)
        : allDrawNumbers

      progress.skippedDraws = allDrawNumbers.length - drawsToProcess.length

      if (drawsToProcess.length === 0) {
        console.log('[Season Backfill] All draws already exist in database')
        progress.phase = 'complete'
        progressCallback?.(progress)
        return {
          success: true,
          totalDraws: allDrawNumbers.length,
          processedDraws: allDrawNumbers.length,
          successfulDraws: allDrawNumbers.length,
          failedDraws: 0,
          skippedDraws: progress.skippedDraws,
          errors: [],
          duration: Date.now() - startTime,
        }
      }

      console.log(
        `[Season Backfill] Processing ${drawsToProcess.length} draws (${progress.skippedDraws} skipped)`
      )

      // Phase 3: Process draws in batches
      progress.phase = 'processing'
      const batches = this.groupIntoBatches(drawsToProcess, batchSize)
      progress.totalBatches = batches.length
      progressCallback?.(progress)

      const failedDraws: Array<{ drawNumber: number; error: string; retryCount: number }> = []

      for (let i = 0; i < batches.length; i++) {
        if (this.isCancelled) {
          console.log('[Season Backfill] Operation cancelled by user')
          break
        }

        progress.currentBatch = i + 1
        console.log(`[Season Backfill] Processing batch ${i + 1}/${batches.length}...`)

        const batch = batches[i]
        if (!batch) continue
        const batchResult = await this.processBatch(batch)

        progress.successfulDraws += batchResult.successful.length
        progress.processedDraws += batch.length

        for (const error of batchResult.failed) {
          failedDraws.push({ ...error, retryCount: 0 })
          progress.errors.push({ ...error, retryCount: 0 })
        }

        progress.failedDraws = failedDraws.length
        progressCallback?.(progress)

        // Circuit breaker check
        if (batchResult.failed.length === batch.length) {
          this.consecutiveFailures++
          if (this.consecutiveFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
            console.warn(
              `[Season Backfill] Circuit breaker triggered after ${this.consecutiveFailures} consecutive failures`
            )
            console.warn(`[Season Backfill] Pausing for ${this.CIRCUIT_BREAKER_PAUSE_MS}ms...`)
            await this.delay(this.CIRCUIT_BREAKER_PAUSE_MS)
            this.consecutiveFailures = 0
          }
        } else {
          this.consecutiveFailures = 0
        }

        // Delay between batches (except last batch)
        if (i < batches.length - 1) {
          await this.delay(this.BATCH_DELAY_MS)
        }
      }

      // Phase 4: Retry failed draws
      if (failedDraws.length > 0 && retryAttempts > 0) {
        console.log(`[Season Backfill] Retrying ${failedDraws.length} failed draws...`)
        const retryResult = await this.retryFailedDraws(failedDraws, retryAttempts)

        progress.successfulDraws += retryResult.successful
        progress.failedDraws = retryResult.stillFailed.length
        progress.errors = retryResult.stillFailed
        progressCallback?.(progress)
      }

      // Phase 5: Archive completed draws if requested
      if (options.archiveOnComplete && progress.successfulDraws > 0) {
        progress.phase = 'archiving'
        progressCallback?.(progress)
        console.log(`[Season Backfill] Marking ${progress.successfulDraws} draws as historic...`)
        await this.archiveDraws(drawsToProcess.slice(0, progress.successfulDraws))
      }

      // Complete
      progress.phase = 'complete'
      progressCallback?.(progress)

      const duration = Date.now() - startTime
      console.log('[Season Backfill] Backfill complete!')
      console.log(
        `[Season Backfill] Total: ${progress.totalDraws}, Successful: ${progress.successfulDraws}, Failed: ${progress.failedDraws}, Skipped: ${progress.skippedDraws}`
      )
      console.log(`[Season Backfill] Duration: ${(duration / 1000).toFixed(2)}s`)

      return {
        success: progress.failedDraws === 0,
        totalDraws: progress.totalDraws,
        processedDraws: progress.processedDraws,
        successfulDraws: progress.successfulDraws,
        failedDraws: progress.failedDraws,
        skippedDraws: progress.skippedDraws,
        errors: progress.errors,
        duration,
      }
    } catch (error) {
      console.error('[Season Backfill] Fatal error during backfill:', error)
      throw error
    }
  }

  /**
   * Discover all draw numbers for a date range by querying month by month
   */
  private async discoverDrawNumbers(startDate: Date, endDate: Date): Promise<number[]> {
    console.log('[Season Backfill] Discovering draw numbers...')

    const drawNumbers: number[] = []
    const months = this.getMonthsInRange(startDate, endDate)

    for (const { year, month } of months) {
      if (this.isCancelled) break

      try {
        console.log(`[Season Backfill] Checking ${year}-${month.toString().padStart(2, '0')}...`)
        const monthDrawNumbers = await svenskaSpelHistoricApi.fetchAvailableDraws(year, month)

        if (monthDrawNumbers.length > 0) {
          drawNumbers.push(...monthDrawNumbers)
          console.log(
            `[Season Backfill] Found ${monthDrawNumbers.length} draws in ${year}-${month}`
          )
        }

        // Rate limiting between discovery calls
        await this.delay(this.DISCOVERY_DELAY_MS)
      } catch (error) {
        console.warn(`[Season Backfill] Error discovering draws for ${year}-${month}:`, error)
        // Continue with other months
      }
    }

    // Sort and deduplicate
    return [...new Set(drawNumbers)].sort((a, b) => a - b)
  }

  /**
   * Filter out draws that already exist in the database
   */
  private async filterExistingDraws(drawNumbers: number[]): Promise<number[]> {
    console.log('[Season Backfill] Filtering existing draws...')

    const existingDraws = await prisma.draws.findMany({
      where: {
        draw_number: {
          in: drawNumbers,
        },
      },
      select: {
        draw_number: true,
      },
    })

    const existingNumbers = new Set(existingDraws.map(d => d.draw_number))
    const newDraws = drawNumbers.filter(num => !existingNumbers.has(num))

    console.log(
      `[Season Backfill] ${existingNumbers.size} draws already exist, ${newDraws.length} to process`
    )
    return newDraws
  }

  /**
   * Group draw numbers into batches
   */
  private groupIntoBatches(drawNumbers: number[], batchSize: number): number[][] {
    const batches: number[][] = []

    for (let i = 0; i < drawNumbers.length; i += batchSize) {
      batches.push(drawNumbers.slice(i, i + batchSize))
    }

    return batches
  }

  /**
   * Process a batch of draws
   */
  private async processBatch(batch: number[]): Promise<BatchResult> {
    console.log(`[Season Backfill] Fetching batch of ${batch.length} draws...`)

    const successful: number[] = []
    const failed: Array<{ drawNumber: number; error: string }> = []

    try {
      // Batch fetch all draws
      const results = await svenskaSpelHistoricApi.fetchMultipleDraws(batch)

      // Process each result
      for (const result of results) {
        if (this.isCancelled) break

        if (result.draw) {
          // Process the draw data we already fetched
          try {
            const syncResult = await drawSyncService.processDrawData(result.draw)

            if (syncResult.success) {
              successful.push(result.drawNumber)
            } else {
              failed.push({
                drawNumber: result.drawNumber,
                error: syncResult.error || 'Unknown sync error',
              })
            }
          } catch (error) {
            failed.push({
              drawNumber: result.drawNumber,
              error: error instanceof Error ? error.message : 'Unknown error during sync',
            })
          }
        } else if (result.error) {
          failed.push({
            drawNumber: result.drawNumber,
            error: result.error,
          })
        }
      }

      console.log(
        `[Season Backfill] Batch complete: ${successful.length} successful, ${failed.length} failed`
      )
      return { successful, failed }
    } catch (error) {
      // Entire batch failed
      console.error('[Season Backfill] Batch fetch failed:', error)
      return {
        successful: [],
        failed: batch.map(drawNumber => ({
          drawNumber,
          error: error instanceof Error ? error.message : 'Batch fetch failed',
        })),
      }
    }
  }

  /**
   * Retry failed draws with exponential backoff
   */
  private async retryFailedDraws(
    failedDraws: Array<{ drawNumber: number; error: string; retryCount: number }>,
    maxRetries: number
  ): Promise<{
    successful: number
    stillFailed: Array<{ drawNumber: number; error: string; retryCount: number }>
  }> {
    let successful = 0
    const stillFailed: Array<{ drawNumber: number; error: string; retryCount: number }> = []

    for (const failedDraw of failedDraws) {
      if (this.isCancelled) break

      let retryCount = 0
      let success = false

      while (retryCount < maxRetries && !success) {
        const backoffDelay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
        console.log(
          `[Season Backfill] Retrying draw ${failedDraw.drawNumber} (attempt ${retryCount + 1}/${maxRetries})...`
        )

        await this.delay(backoffDelay)

        try {
          // Fetch the draw data
          const draw = await svenskaSpelHistoricApi.fetchHistoricDraw(failedDraw.drawNumber)

          if (draw) {
            // Process the fetched draw
            const result = await drawSyncService.processDrawData(draw)

            if (result.success) {
              successful++
              success = true
              console.log(
                `[Season Backfill] Successfully synced draw ${failedDraw.drawNumber} on retry`
              )
            } else {
              retryCount++
              failedDraw.error = result.error || 'Unknown retry error'
              failedDraw.retryCount = retryCount
            }
          } else {
            retryCount++
            failedDraw.error = 'Failed to fetch draw data'
            failedDraw.retryCount = retryCount
          }
        } catch (error) {
          retryCount++
          failedDraw.error = error instanceof Error ? error.message : 'Unknown retry error'
          failedDraw.retryCount = retryCount
        }
      }

      if (!success) {
        stillFailed.push(failedDraw)
      }
    }

    console.log(
      `[Season Backfill] Retry complete: ${successful} recovered, ${stillFailed.length} still failed`
    )
    return { successful, stillFailed }
  }

  /**
   * Mark draws as historic (is_current = false)
   */
  private async archiveDraws(drawNumbers: number[]): Promise<void> {
    try {
      await prisma.draws.updateMany({
        where: {
          draw_number: {
            in: drawNumbers,
          },
        },
        data: {
          is_current: false,
          archived_at: new Date(),
        },
      })
      console.log(`[Season Backfill] Archived ${drawNumbers.length} draws`)
    } catch (error) {
      console.warn('[Season Backfill] Error archiving draws:', error)
      // Non-fatal - continue
    }
  }

  /**
   * Get array of {year, month} objects for date range
   */
  private getMonthsInRange(startDate: Date, endDate: Date): Array<{ year: number; month: number }> {
    const months: Array<{ year: number; month: number }> = []

    const current = new Date(startDate)
    current.setDate(1) // Normalize to first of month

    while (current <= endDate) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1, // JavaScript months are 0-indexed
      })

      current.setMonth(current.getMonth() + 1)
    }

    return months
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Cancel the current operation
   */
  cancel(): void {
    console.log('[Season Backfill] Cancellation requested')
    this.isCancelled = true
  }
}

// Export singleton instance
export const seasonBackfillService = new SeasonBackfillService()
