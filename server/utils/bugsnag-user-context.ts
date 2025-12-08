import Bugsnag from '@bugsnag/js'
import type { H3Event } from 'h3'
import { getAuthenticatedUser } from './get-authenticated-user'
import { costCapService } from '../services/cost-cap-service'

/**
 * Check if Bugsnag is initialized
 */
function isBugsnagReady(): boolean {
  try {
    return Bugsnag.isStarted()
  } catch {
    return false
  }
}

export interface UserBugsnagContext {
  userId: string
  email: string
  isAdmin: boolean
  costCapUsd: number
  currentSpending: number
  remainingBudget: number
  hasBypass: boolean
}

/**
 * Set Bugsnag user context from an authenticated request.
 * Call this at the start of API handlers that need user context in error reports.
 *
 * @param event - H3 event from the request
 * @returns User context if available, null otherwise
 */
export async function setBugsnagUserContext(event: H3Event): Promise<UserBugsnagContext | null> {
  if (!isBugsnagReady()) return null

  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(event)

    // Get cost cap info
    const costCapResult = await costCapService.checkUserCostCap(user.id, user.email)

    const context: UserBugsnagContext = {
      userId: user.id,
      email: user.email,
      isAdmin: costCapResult.isAdmin,
      costCapUsd: costCapResult.capAmount,
      currentSpending: costCapResult.currentSpending,
      remainingBudget: costCapResult.remainingBudget,
      hasBypass: costCapResult.hasBypass,
    }

    // Set user in Bugsnag
    Bugsnag.setUser(user.id, user.email)

    // Add user metadata
    Bugsnag.addMetadata('userProfile', {
      isAdmin: context.isAdmin,
      costCapUsd: context.costCapUsd,
      currentSpending: context.currentSpending,
      remainingBudget: context.remainingBudget,
      hasBypass: context.hasBypass,
    })

    // Store in event context for later use
    ;(event.context as Record<string, unknown>).userId = user.id
    ;(event.context as Record<string, unknown>).userEmail = user.email

    return context
  } catch {
    // User not authenticated or error getting cost cap
    // This is fine - not all requests require authentication
    return null
  }
}

/**
 * Set minimal user context when full cost cap check isn't needed.
 * Useful for lightweight endpoints.
 */
export async function setBugsnagUserContextMinimal(
  event: H3Event
): Promise<{ userId: string; email: string } | null> {
  if (!isBugsnagReady()) return null

  try {
    const user = await getAuthenticatedUser(event)

    Bugsnag.setUser(user.id, user.email)

    // Store in event context
    ;(event.context as Record<string, unknown>).userId = user.id
    ;(event.context as Record<string, unknown>).userEmail = user.email

    return { userId: user.id, email: user.email }
  } catch {
    return null
  }
}

/**
 * Clear user context (useful after request completes)
 */
export function clearBugsnagUserContext(): void {
  if (!isBugsnagReady()) return

  Bugsnag.setUser(undefined, undefined, undefined)
  Bugsnag.clearMetadata('userProfile')
}
