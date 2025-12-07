import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async event => {
  // Skip auth check for login and confirm pages
  const path = getRequestURL(event).pathname
  if (path === '/login' || path === '/confirm') {
    return
  }

  // Skip auth check for API routes (they have their own auth if needed)
  if (path.startsWith('/api/')) {
    return
  }

  // Skip auth check for static assets
  if (path.startsWith('/_nuxt/') || path.startsWith('/__nuxt')) {
    return
  }

  // Skip auth if Supabase is not configured (e.g., in CI/testing environments)
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return
  }

  try {
    const user = await serverSupabaseUser(event)

    if (!user) {
      // Not authenticated - the @nuxtjs/supabase module will handle redirect
      return
    }

    // Check if user email is in the allowed list
    const config = useRuntimeConfig()
    const allowedEmails = config.allowedEmails
      ? config.allowedEmails.split(',').map((e: string) => e.trim().toLowerCase())
      : []

    // If no allowed emails configured, allow all authenticated users
    if (allowedEmails.length === 0) {
      return
    }

    const userEmail = user.email?.toLowerCase()
    if (!userEmail || !allowedEmails.includes(userEmail)) {
      // User is authenticated but not authorized
      // Sign them out and redirect to login with error
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied. Your email is not authorized to access this application.',
      })
    }
  } catch (error) {
    // If it's already a H3 error, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    // For other errors (like Supabase connection issues), log and continue
    console.error('[Auth Middleware] Error checking user:', error)
  }
})
