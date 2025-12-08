import { serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'

export interface AuthenticatedUser {
  id: string
  email: string
}

/**
 * Get the authenticated user from a request event.
 * Throws 401 error if not authenticated.
 */
export async function getAuthenticatedUser(event: H3Event): Promise<AuthenticatedUser> {
  const user = await serverSupabaseUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required',
    })
  }

  return {
    id: user.sub,
    email: user.email || '',
  }
}
