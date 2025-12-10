import { serverSupabaseUser } from '#supabase/server'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async event => {
  // Skip auth check in test mode (for E2E tests)
  if (process.env.TEST_MODE === 'true') {
    return
  }

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

    const userId = user.sub || user.id
    const userEmail = user.email?.toLowerCase()

    // Check if user has a profile in our database (indicates they were invited)
    // First try by user_id (for existing users), then by email (for pending invites)
    let userProfile = await prisma.user_profiles.findFirst({
      where: { user_id: userId },
    })

    // If no profile by user_id, check by email (for pending invites where user_id is null)
    if (!userProfile && userEmail) {
      userProfile = await prisma.user_profiles.findFirst({
        where: { email: { equals: userEmail, mode: 'insensitive' } },
      })
    }

    if (userProfile) {
      // User has a profile - check if they're disabled
      if (userProfile.disabled_at) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Your account has been disabled. Please contact an administrator.',
        })
      }

      // If this is a pending profile (user_id is null), update with the real Supabase ID
      if (userProfile.user_id === null && userId) {
        await prisma.user_profiles.update({
          where: { id: userProfile.id },
          data: { user_id: userId },
        })
      }

      // User is authorized
      return
    }

    // No profile found - fall back to ALLOWED_EMAILS env var for backwards compatibility
    const config = useRuntimeConfig()
    const allowedEmails = config.allowedEmails
      ? config.allowedEmails.split(',').map((e: string) => e.trim().toLowerCase())
      : []

    // If no allowed emails configured and no profile, deny access
    if (allowedEmails.length === 0) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied. You have not been invited to this application.',
      })
    }

    // Check against env var allowlist (legacy support)
    if (!userEmail || !allowedEmails.includes(userEmail)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied. Your email is not authorized to access this application.',
      })
    }

    // User is in the env var allowlist but doesn't have a profile yet
    // Create one for them (legacy users)
    await prisma.user_profiles.create({
      data: {
        user_id: userId,
        email: userEmail,
        is_admin: false,
        cost_cap_usd: 1.0,
      },
    })
  } catch (error) {
    // If it's already a H3 error, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    // For other errors (like Supabase connection issues), log and continue
    console.error('[Auth Middleware] Error checking user:', error)
  }
})
