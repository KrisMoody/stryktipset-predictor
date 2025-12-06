/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment -- Browser fingerprint injection requires dynamic types */
import type { BrowserContext } from 'playwright'

/**
 * Common user agents for rotation
 */
const userAgents = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
]

/**
 * Get a random user agent
 */
export function getRandomUserAgent(): string {
  const agent = userAgents[Math.floor(Math.random() * userAgents.length)]
  return agent || userAgents[0] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

/**
 * Common viewport sizes
 */
const viewports = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 2560, height: 1440 },
]

/**
 * Get a random viewport size
 */
export function getRandomViewport(): { width: number; height: number } {
  const viewport = viewports[Math.floor(Math.random() * viewports.length)]
  return viewport || { width: 1920, height: 1080 }
}

/**
 * Configure browser context with anti-detection measures
 */
export async function configureAntiDetection(context: BrowserContext): Promise<void> {
  // Add init scripts to hide automation indicators
  await context.addInitScript(() => {
    // Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    })

    // Override chrome property
    // @ts-ignore
    window.chrome = {
      runtime: {},
    }

    // Override permissions
    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.query = (parameters: any) => {
      if (parameters.name === 'notifications') {
        return Promise.resolve({ state: 'denied' } as PermissionStatus)
      }
      return originalQuery(parameters)
    }

    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    })

    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['sv-SE', 'sv', 'en-US', 'en'],
    })
  })
}

/**
 * Get realistic headers for requests
 */
export function getRealisticHeaders(): Record<string, string> {
  return {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  }
}
