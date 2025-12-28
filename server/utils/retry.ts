/**
 * Retry utility for async operations with exponential backoff
 */

export interface RetryOptions {
  /** Number of retry attempts (default: 3) */
  retries?: number
  /** Initial delay in ms (default: 1000) */
  delay?: number
  /** Use exponential backoff (default: true) */
  backoff?: boolean
  /** Maximum delay in ms when using backoff (default: 10000) */
  maxDelay?: number
  /** Optional callback for logging retries */
  onRetry?: (attempt: number, error: Error) => void
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  retries: 3,
  delay: 1000,
  backoff: true,
  maxDelay: 10000,
}

/**
 * Execute an async function with retry logic
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries, delay, backoff, maxDelay } = { ...DEFAULT_OPTIONS, ...options }
  const { onRetry } = options

  let lastError: Error | undefined
  let currentDelay = delay

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < retries) {
        onRetry?.(attempt + 1, lastError)

        await sleep(currentDelay)

        if (backoff) {
          currentDelay = Math.min(currentDelay * 2, maxDelay)
        }
      }
    }
  }

  throw lastError
}

/**
 * Fetch with timeout using AbortController
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 20000)
 * @returns Fetch response
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 20000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
