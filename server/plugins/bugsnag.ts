import Bugsnag from '@bugsnag/js'
import type { H3Event } from 'h3'
import { getRequestURL, getHeaders, getQuery } from 'h3'

let bugsnagInitialized = false

export default defineNitroPlugin(nitroApp => {
  const config = useRuntimeConfig()

  // Only initialize if API key is configured
  if (!config.bugsnagApiKey) {
    console.warn('[Bugsnag] API key not configured, skipping server initialization')
    return
  }

  // Prevent double initialization
  if (bugsnagInitialized) {
    return
  }

  // Initialize Bugsnag
  Bugsnag.start({
    apiKey: config.bugsnagApiKey as string,
    releaseStage: (config.bugsnagReleaseStage as string) || 'production',
    appVersion: (config.bugsnagAppVersion as string) || '1.0.0',
    enabledReleaseStages: ['production', 'staging'],
    appType: 'server',

    // Automatic detection
    autoDetectErrors: true,
    autoTrackSessions: false, // Disable sessions for server-side (too noisy)

    // Context and metadata
    onError: event => {
      // Add deployment information
      event.addMetadata('deployment', {
        platform: 'vercel',
        nodeVersion: process.version,
        environment: process.env.NODE_ENV,
      })

      // Add runtime config (non-sensitive)
      event.addMetadata('config', {
        enableScraperV3: config.enableScraperV3,
        enableAiScraper: config.enableAiScraper,
      })
    },
  })

  bugsnagInitialized = true

  // Hook into Nitro error handler
  nitroApp.hooks.hook('error', (error, { event }) => {
    captureServerError(error, event as H3Event | undefined)
  })

  console.log('[Bugsnag] Server-side error tracking initialized')
})

/**
 * Check if Bugsnag is initialized and ready
 */
export function isBugsnagReady(): boolean {
  return bugsnagInitialized && Bugsnag.isStarted()
}

/**
 * Capture server-side errors with request context
 */
export function captureServerError(error: Error | unknown, event?: H3Event): void {
  if (!isBugsnagReady()) return

  const errorObj = error instanceof Error ? error : new Error(String(error))

  Bugsnag.notify(errorObj, bugsnagEvent => {
    // Add request context if available
    if (event) {
      try {
        const url = getRequestURL(event)
        const method = event.method
        const headers = getHeaders(event)
        const query = getQuery(event)

        bugsnagEvent.request = {
          url: url.toString(),
          httpMethod: method,
          headers: {
            'user-agent': headers['user-agent'] || '',
            'content-type': headers['content-type'] || '',
          },
        }

        bugsnagEvent.addMetadata('request', {
          query,
          path: url.pathname,
        })

        // Add user context if available from event context
        const userId = (event.context as { userId?: string })?.userId
        const userEmail = (event.context as { userEmail?: string })?.userEmail
        if (userId) {
          bugsnagEvent.setUser(userId, userEmail)
        }
      } catch {
        // Ignore if we can't get request context
      }
    }
  })
}
