import type { Page } from 'playwright'

/**
 * Generate random delay to mimic human behavior
 */
export function humanDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise(resolve => setTimeout(resolve, delay))
}

/**
 * Simulate human-like mouse movement before clicking
 */
export async function humanClick(page: Page, selector: string): Promise<void> {
  try {
    const element = await page.locator(selector)
    await element.hover()
    await humanDelay(100, 300)
    await element.click()
  }
  catch (error) {
    console.error(`[Human Behavior] Error clicking ${selector}:`, error)
    throw error
  }
}

/**
 * Simulate human-like scrolling
 */
export async function humanScroll(page: Page, direction: 'up' | 'down' = 'down', amount: number = 300): Promise<void> {
  try {
    const scrollAmount = direction === 'down' ? amount : -amount
    await page.evaluate((scroll) => {
      window.scrollBy({
        top: scroll,
        left: 0,
        behavior: 'smooth',
      })
    }, scrollAmount)
    await humanDelay(500, 1000)
  }
  catch (error) {
    console.error(`[Human Behavior] Error scrolling:`, error)
  }
}

/**
 * Simulate random page interactions
 */
export async function randomPageInteraction(page: Page): Promise<void> {
  const actions = [
    async () => await humanScroll(page, 'down', Math.floor(Math.random() * 200) + 100),
    async () => await humanScroll(page, 'up', Math.floor(Math.random() * 100) + 50),
    async () => await page.mouse.move(Math.floor(Math.random() * 500), Math.floor(Math.random() * 500)),
  ]

  const randomAction = actions[Math.floor(Math.random() * actions.length)]
  if (randomAction) {
    await randomAction()
  }
}

/**
 * Perform multiple human-like interactions to appear more natural
 */
export async function performNaturalBehavior(page: Page): Promise<void> {
  try {
    // Random mouse movement
    await page.mouse.move(
      Math.floor(Math.random() * 800) + 100,
      Math.floor(Math.random() * 400) + 100,
    )
    await humanDelay(200, 500)

    // Scroll down a bit
    await humanScroll(page, 'down', Math.floor(Math.random() * 150) + 100)
    await humanDelay(500, 1000)

    // Scroll back up slightly
    await humanScroll(page, 'up', Math.floor(Math.random() * 50) + 25)
    await humanDelay(300, 700)

    // Final mouse movement
    await page.mouse.move(
      Math.floor(Math.random() * 600) + 200,
      Math.floor(Math.random() * 300) + 150,
    )
  }
  catch (error) {
    console.error('[Human Behavior] Error performing natural behavior:', error)
  }
}

/**
 * Wait for a random "reading" time based on content
 */
export async function humanReadingDelay(contentLength: number = 1000): Promise<void> {
  // Assume average reading speed of 200 words per minute
  // Average word length: 5 characters
  const words = contentLength / 5
  const readingTimeMs = (words / 200) * 60 * 1000

  // Add some randomness (50-150% of calculated time)
  const minTime = readingTimeMs * 0.5
  const maxTime = readingTimeMs * 1.5
  const actualTime = Math.floor(Math.random() * (maxTime - minTime)) + minTime

  // Cap at reasonable limits (1-10 seconds)
  const cappedTime = Math.min(Math.max(actualTime, 1000), 10000)

  await new Promise(resolve => setTimeout(resolve, cappedTime))
}

/**
 * Detect rate limiting or blocking
 */
export async function detectRateLimit(page: Page): Promise<{ isRateLimited: boolean, responseCode?: number, reason?: string }> {
  try {
    // Check for common rate limit indicators
    const title = await page.title()
    const content = await page.content()
    const url = page.url()

    // Check for Svenska Spel specific rate limit patterns
    const rateLimitPatterns = [
      { pattern: /rate limit/i, reason: 'Rate limit text detected' },
      { pattern: /too many requests/i, reason: 'Too many requests message' },
      { pattern: /429/, reason: 'HTTP 429 status code' },
      { pattern: /access denied/i, reason: 'Access denied message' },
      { pattern: /captcha/i, reason: 'CAPTCHA detected' },
      { pattern: /blocked/i, reason: 'Blocked message' },
      { pattern: /cloudflare/i, reason: 'Cloudflare protection page' },
      { pattern: /just a moment/i, reason: 'Cloudflare challenge page' },
      { pattern: /checking your browser/i, reason: 'Browser check in progress' },
      { pattern: /please wait/i, reason: 'Wait page detected' },
    ]

    // Check title for rate limit indicators (more reliable)
    for (const { pattern, reason } of rateLimitPatterns) {
      if (pattern.test(title)) {
        console.log(`[Human Behavior] Rate limit detected in title: ${reason}`)
        return { isRateLimited: true, reason }
      }
    }

    // Check if we're on an error page or redirected away from svenskaspel.se
    if (!url.includes('svenskaspel.se')) {
      console.log(`[Human Behavior] Redirected away from svenskaspel.se to: ${url}`)
      return { isRateLimited: true, reason: 'Redirected away from target domain' }
    }

    // Check for specific Svenska Spel error pages
    if (title.toLowerCase().includes('error') || title.toLowerCase().includes('fel')) {
      console.log(`[Human Behavior] Error page detected: ${title}`)
      return { isRateLimited: true, reason: 'Error page detected' }
    }

    // Only check content for very specific patterns to avoid false positives
    const specificContentPatterns = [
      { pattern: /too many requests/i, reason: 'Too many requests in content' },
      { pattern: /429/i, reason: 'HTTP 429 in content' },
    ]

    for (const { pattern, reason } of specificContentPatterns) {
      if (pattern.test(content)) {
        console.log(`[Human Behavior] Rate limit detected in content: ${reason}`)
        return { isRateLimited: true, reason }
      }
    }

    return { isRateLimited: false }
  }
  catch (error) {
    console.error('[Human Behavior] Error detecting rate limit:', error)
    return { isRateLimited: false }
  }
}
