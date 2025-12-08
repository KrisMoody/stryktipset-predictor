import { requireAdmin } from '~/server/utils/require-admin'
import { getAuthenticatedUser } from '~/server/utils/get-authenticated-user'
import { inviteUserByEmail } from '~/server/utils/supabase-admin'
import { costCapService } from '~/server/services/cost-cap-service'

/**
 * POST /api/admin/users/invite
 * Invite a new user by email (admin only)
 */
export default defineEventHandler(async event => {
  await requireAdmin(event)

  const body = await readBody(event)
  const { email } = body

  if (!email || typeof email !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Email is required',
    })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid email format',
    })
  }

  // Check if user already exists
  const existingProfile = await costCapService.getUserProfileByEmail(email)
  if (existingProfile) {
    // Check if this is a pending invitation that hasn't been accepted
    if (existingProfile.userId === null) {
      // Allow re-sending invitation
      const result = await inviteUserByEmail(email)
      if (!result.success) {
        throw createError({
          statusCode: 500,
          message: result.error || 'Failed to resend invitation',
        })
      }

      return {
        success: true,
        message: 'Invitation resent',
        email,
        isResend: true,
      }
    }

    throw createError({
      statusCode: 409,
      message: 'User with this email already exists',
    })
  }

  // Get the admin user who is inviting
  const adminUser = await getAuthenticatedUser(event)

  // Send Supabase invitation email
  const result = await inviteUserByEmail(email)

  if (!result.success) {
    throw createError({
      statusCode: 500,
      message: result.error || 'Failed to send invitation',
    })
  }

  // Create the user profile record
  await costCapService.createInvitedUserProfile(email, adminUser.id)

  return {
    success: true,
    message: 'Invitation sent successfully',
    email,
    isResend: false,
  }
})
