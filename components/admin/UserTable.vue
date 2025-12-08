<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-700">
          <th class="text-left py-3 px-4 font-semibold">User</th>
          <th class="text-left py-3 px-4 font-semibold">Status</th>
          <th class="text-right py-3 px-4 font-semibold">Weekly</th>
          <th class="text-right py-3 px-4 font-semibold">30 Days</th>
          <th class="text-right py-3 px-4 font-semibold">All Time</th>
          <th class="text-right py-3 px-4 font-semibold">Cap</th>
          <th class="text-right py-3 px-4 font-semibold">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="user in users"
          :key="user.userId || user.email"
          class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
          :class="{ 'opacity-50': user.disabledAt }"
        >
          <!-- User Info -->
          <td class="py-3 px-4">
            <div>
              <p class="font-medium truncate max-w-48" :title="user.email">
                {{ user.email }}
              </p>
              <p class="text-xs text-gray-500">Joined {{ formatDate(user.createdAt) }}</p>
            </div>
          </td>

          <!-- Status Badges -->
          <td class="py-3 px-4">
            <div class="flex flex-wrap gap-1">
              <UBadge v-if="user.isAdmin" color="primary" variant="subtle" size="xs">
                Admin
              </UBadge>
              <UBadge v-if="user.disabledAt" color="error" variant="subtle" size="xs">
                Disabled
              </UBadge>
              <UBadge
                v-if="user.capBypassUntil && new Date(user.capBypassUntil) > new Date()"
                color="warning"
                variant="subtle"
                size="xs"
              >
                Bypass
              </UBadge>
              <UBadge v-if="user.userId === null" color="neutral" variant="subtle" size="xs">
                Pending
              </UBadge>
            </div>
          </td>

          <!-- Weekly Spending -->
          <td class="py-3 px-4 text-right">
            <div>
              <p :class="getSpendingColor(user)">${{ formatCost(user.currentWeekSpending) }}</p>
              <div v-if="!user.isAdmin" class="w-20 ml-auto">
                <div class="bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                  <div
                    class="h-1.5 rounded-full"
                    :class="getProgressBarColor(user)"
                    :style="{ width: `${getSpendingPercent(user)}%` }"
                  />
                </div>
              </div>
            </div>
          </td>

          <!-- 30 Day Spending -->
          <td class="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
            ${{ formatCost(user.thirtyDaySpending) }}
          </td>

          <!-- All Time Spending -->
          <td class="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
            ${{ formatCost(user.allTimeSpending) }}
          </td>

          <!-- Cost Cap -->
          <td class="py-3 px-4 text-right">
            <span v-if="user.isAdmin" class="text-gray-400">-</span>
            <span v-else>${{ user.costCapUsd.toFixed(2) }}</span>
          </td>

          <!-- Actions -->
          <td class="py-3 px-4 text-right">
            <UDropdownMenu :items="getDropdownItems(user)" :ui="{ content: 'min-w-40' }">
              <UButton
                icon="i-heroicons-ellipsis-vertical"
                variant="ghost"
                size="xs"
                aria-label="User actions"
              />
            </UDropdownMenu>
          </td>
        </tr>

        <!-- Empty State -->
        <tr v-if="users.length === 0">
          <td colspan="7" class="py-8 text-center text-gray-500">
            <UIcon name="i-heroicons-users" class="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No users found</p>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
export interface UserWithSpending {
  id: number
  userId: string | null // null for pending invites
  email: string
  isAdmin: boolean
  costCapUsd: number
  capBypassUntil: string | null
  currentWeekSpending: number
  thirtyDaySpending: number
  allTimeSpending: number
  remainingBudget: number
  invitedBy: string | null
  invitedAt: string | null
  disabledAt: string | null
  disabledBy: string | null
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  users: UserWithSpending[]
  currentUserId: string | null
}>()

const emit = defineEmits<{
  editCap: [user: UserWithSpending]
  setBypass: [user: UserWithSpending]
  clearBypass: [user: UserWithSpending]
  toggleAdmin: [user: UserWithSpending]
  toggleDisable: [user: UserWithSpending]
  resendInvite: [user: UserWithSpending]
  deleteInvite: [user: UserWithSpending]
}>()

function formatCost(cost: number): string {
  if (cost >= 1) return cost.toFixed(2)
  if (cost >= 0.01) return cost.toFixed(3)
  return cost.toFixed(4)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getSpendingPercent(user: UserWithSpending): number {
  if (user.isAdmin || user.costCapUsd === 0) return 0
  return Math.min(100, (user.currentWeekSpending / user.costCapUsd) * 100)
}

function getSpendingColor(user: UserWithSpending): string {
  if (user.isAdmin) return 'text-gray-600 dark:text-gray-400'
  const percent = getSpendingPercent(user)
  if (percent >= 100) return 'text-red-600 dark:text-red-400 font-medium'
  if (percent >= 80) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-green-600 dark:text-green-400'
}

function getProgressBarColor(user: UserWithSpending): string {
  const percent = getSpendingPercent(user)
  if (percent >= 100) return 'bg-red-500'
  if (percent >= 80) return 'bg-yellow-500'
  return 'bg-green-500'
}

function getDropdownItems(user: UserWithSpending) {
  const isCurrentUser = user.userId !== null && user.userId === props.currentUserId
  const hasBypass = user.capBypassUntil && new Date(user.capBypassUntil) > new Date()
  const isDisabled = !!user.disabledAt
  const isPending = user.userId === null

  const items = []

  // Pending user actions
  if (isPending) {
    items.push({
      label: 'Resend Invite',
      icon: 'i-heroicons-paper-airplane',
      onSelect: () => emit('resendInvite', user),
    })
    items.push({
      label: 'Delete Invite',
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => emit('deleteInvite', user),
    })
    return [items]
  }

  // Edit cost cap
  if (!user.isAdmin) {
    items.push({
      label: 'Edit Cost Cap',
      icon: 'i-heroicons-currency-dollar',
      onSelect: () => emit('editCap', user),
    })
  }

  // Bypass options
  if (!user.isAdmin) {
    if (hasBypass) {
      items.push({
        label: 'Clear Bypass',
        icon: 'i-heroicons-x-circle',
        onSelect: () => emit('clearBypass', user),
      })
    } else {
      items.push({
        label: 'Set Bypass',
        icon: 'i-heroicons-clock',
        onSelect: () => emit('setBypass', user),
      })
    }
  }

  // Separator
  if (items.length > 0) {
    items.push({ type: 'separator' as const })
  }

  // Admin toggle
  if (!isCurrentUser) {
    items.push({
      label: user.isAdmin ? 'Remove Admin' : 'Make Admin',
      icon: user.isAdmin ? 'i-heroicons-shield-exclamation' : 'i-heroicons-shield-check',
      onSelect: () => emit('toggleAdmin', user),
    })
  }

  // Disable/Enable toggle
  if (!isCurrentUser) {
    items.push({
      label: isDisabled ? 'Enable User' : 'Disable User',
      icon: isDisabled ? 'i-heroicons-check-circle' : 'i-heroicons-no-symbol',
      color: isDisabled ? 'success' : 'error',
      onSelect: () => emit('toggleDisable', user),
    })
  }

  return [items]
}
</script>
