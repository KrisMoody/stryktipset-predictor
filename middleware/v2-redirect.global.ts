import type { LocationQueryRaw } from 'vue-router'

const UI_PREFERENCE_KEY = 'st-predictor-ui-preference'

/**
 * Global middleware that handles V2 routing based on feature flag and user preference.
 *
 * Behavior:
 * - If ENABLE_UI_V2=false: No redirects, V2 routes not accessible
 * - If ENABLE_UI_V2=true and user preference='v2': Redirect to V2 routes
 * - If ENABLE_UI_V2=true and user preference='v1': Stay on V1 routes
 * - If ENABLE_UI_V2=true and no preference: Stay on V1 (show banner to opt-in)
 */
export default defineNuxtRouteMiddleware(to => {
  const config = useRuntimeConfig()

  // V2 must be enabled via feature flag
  if (!config.public.enableUIV2) {
    // If trying to access V2 routes when disabled, redirect to V1
    if (to.path.startsWith('/v2')) {
      const v1Path = to.path.replace('/v2', '') || '/'
      return navigateTo({ path: v1Path, query: to.query })
    }
    return
  }

  // Don't process API routes, auth routes, or special routes
  if (
    to.path.startsWith('/api') ||
    to.path.startsWith('/login') ||
    to.path.startsWith('/confirm') ||
    to.path.startsWith('/_')
  ) {
    return
  }

  // Check user preference from localStorage (only on client)
  let userPreference: string | null = null
  if (import.meta.client) {
    userPreference = localStorage.getItem(UI_PREFERENCE_KEY)
  }

  // If user explicitly chose V1, don't redirect to V2
  if (userPreference === 'v1') {
    // But if they're trying to access V2 routes directly, allow it
    return
  }

  // If user chose V2, redirect from V1 to V2
  if (userPreference === 'v2' && !to.path.startsWith('/v2')) {
    return redirectToV2(to)
  }

  // No preference set: stay on current UI (banner will prompt them)
})

function redirectToV2(to: { path: string; query: LocationQueryRaw }) {
  // Map old routes to V2 routes
  const routeMap: Record<string, string> = {
    '/': '/v2',
    '/draw': '/v2',
    '/analytics': '/v2/analytics',
    '/ai-dashboard': '/v2/ai-dashboard',
    '/performance': '/v2/performance',
    '/admin': '/v2/admin',
  }

  // Check for draw detail pages: /draw/123 -> /v2/draw/123
  const drawMatch = to.path.match(/^\/draw\/(\d+)$/)
  if (drawMatch) {
    return navigateTo({
      path: `/v2/draw/${drawMatch[1]}`,
      query: to.query,
    })
  }

  // Check for draw optimize pages: /draw/123/optimize -> /v2/draw/123/optimize
  const optimizeMatch = to.path.match(/^\/draw\/(\d+)\/optimize$/)
  if (optimizeMatch) {
    return navigateTo({
      path: `/v2/draw/${optimizeMatch[1]}/optimize`,
      query: to.query,
    })
  }

  // Check for direct route mapping
  const mappedPath = routeMap[to.path]
  if (mappedPath) {
    return navigateTo({
      path: mappedPath,
      query: to.query,
    })
  }
}
