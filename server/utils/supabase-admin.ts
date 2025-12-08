import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from './logger'

const logger = createLogger('SupabaseAdmin')

let adminClient: SupabaseClient | null = null

/**
 * Get Supabase admin client for server-side admin operations
 * Uses the secret/service role key for elevated privileges
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) {
    return adminClient
  }

  const config = useRuntimeConfig()
  const supabaseUrl = process.env.SUPABASE_URL

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required')
  }

  if (!config.supabaseSecretKey) {
    throw new Error(
      'SUPABASE_SECRET_KEY environment variable is required for admin operations. ' +
        'Get this from your Supabase Dashboard → Settings → API → Secret key (service_role).'
    )
  }

  adminClient = createClient(supabaseUrl, config.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  logger.info('Supabase admin client initialized')

  return adminClient
}

export interface InviteUserResult {
  success: boolean
  error?: string
  userId?: string
}

/**
 * Invite a user by email using Supabase Admin API
 * This sends a magic link email to the user
 */
export async function inviteUserByEmail(email: string): Promise<InviteUserResult> {
  try {
    const supabase = getSupabaseAdmin()
    const config = useRuntimeConfig()

    // Get the redirect URL for after invite confirmation
    const redirectTo = config.public?.siteUrl
      ? `${config.public.siteUrl}/confirm`
      : process.env.NUXT_PUBLIC_SITE_URL
        ? `${process.env.NUXT_PUBLIC_SITE_URL}/confirm`
        : undefined

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    })

    if (error) {
      logger.error('Failed to invite user', error, { email })
      return {
        success: false,
        error: error.message,
      }
    }

    logger.info('User invited successfully', { email, userId: data.user?.id })

    return {
      success: true,
      userId: data.user?.id,
    }
  } catch (error) {
    logger.error('Error inviting user', error, { email })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete a user from Supabase Auth (use with caution)
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin()

    const { error } = await supabase.auth.admin.deleteUser(userId)

    if (error) {
      logger.error('Failed to delete user', error, { userId })
      return {
        success: false,
        error: error.message,
      }
    }

    logger.info('User deleted from Supabase Auth', { userId })

    return { success: true }
  } catch (error) {
    logger.error('Error deleting user', error, { userId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
