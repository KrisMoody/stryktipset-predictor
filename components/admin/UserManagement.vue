<template>
  <div>
    <!-- Header with Invite Button -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <UButton
          size="xs"
          variant="ghost"
          icon="i-heroicons-arrow-path"
          :loading="loading"
          @click="loadUsers"
        >
          Refresh
        </UButton>
      </div>
      <UButton icon="i-heroicons-user-plus" color="primary" @click="showInviteModal = true">
        Invite User
      </UButton>
    </div>

    <!-- Loading State -->
    <div v-if="loading && !users.length" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>

    <!-- Error State -->
    <UAlert v-else-if="error" color="error" icon="i-heroicons-exclamation-triangle" class="mb-4">
      <template #title>Failed to load users</template>
      <template #description>{{ error }}</template>
    </UAlert>

    <!-- User Table -->
    <AdminUserTable
      v-else
      :users="users"
      :current-user-id="currentUserId"
      @edit-cap="handleEditCap"
      @set-bypass="handleSetBypass"
      @clear-bypass="handleClearBypass"
      @toggle-admin="handleToggleAdmin"
      @toggle-disable="handleToggleDisable"
      @resend-invite="handleResendInvite"
      @delete-invite="handleDeleteInvite"
    />

    <!-- Invite Modal -->
    <AdminInviteUserModal v-model:open="showInviteModal" @invited="handleUserInvited" />

    <!-- Edit Modal -->
    <AdminUserEditModal
      v-model:open="showEditModal"
      :user="selectedUser"
      :mode="editMode"
      @saved="handleEditSaved"
    />
  </div>
</template>

<script setup lang="ts">
import type { UserWithSpending } from './UserTable.vue'

const toast = useToast()

// State
const loading = ref(false)
const error = ref<string | null>(null)
const users = ref<UserWithSpending[]>([])
const currentUserId = ref<string | null>(null)

// Modals
const showInviteModal = ref(false)
const showEditModal = ref(false)
const selectedUser = ref<UserWithSpending | null>(null)
const editMode = ref<'cap' | 'bypass'>('cap')

// Load users on mount
onMounted(async () => {
  await loadUsers()
  // Get current user ID from profile
  try {
    const profile = await $fetch<{ userId: string }>('/api/user/profile')
    currentUserId.value = profile.userId
  } catch {
    // Ignore - not critical
  }
})

async function loadUsers() {
  loading.value = true
  error.value = null

  try {
    const response = await $fetch<{ success: boolean; users: UserWithSpending[] }>(
      '/api/admin/users'
    )
    if (response.success) {
      users.value = response.users
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load users'
  } finally {
    loading.value = false
  }
}

function handleEditCap(user: UserWithSpending) {
  selectedUser.value = user
  editMode.value = 'cap'
  showEditModal.value = true
}

function handleSetBypass(user: UserWithSpending) {
  selectedUser.value = user
  editMode.value = 'bypass'
  showEditModal.value = true
}

async function handleClearBypass(user: UserWithSpending) {
  try {
    await $fetch(`/api/admin/users/${user.userId}/bypass`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Bypass cleared',
      description: `Bypass removed for ${user.email}`,
      color: 'success',
    })
    await loadUsers()
  } catch (err) {
    toast.add({
      title: 'Failed to clear bypass',
      description: err instanceof Error ? err.message : 'Unknown error',
      color: 'error',
    })
  }
}

async function handleToggleAdmin(user: UserWithSpending) {
  const newStatus = !user.isAdmin

  // Confirm before removing admin
  if (!newStatus) {
    const confirmed = confirm(
      `Are you sure you want to remove admin privileges from ${user.email}?`
    )
    if (!confirmed) return
  }

  try {
    await $fetch(`/api/admin/users/${user.userId}/admin`, {
      method: 'PATCH',
      body: { isAdmin: newStatus },
    })
    toast.add({
      title: newStatus ? 'Admin granted' : 'Admin revoked',
      description: `${user.email} is ${newStatus ? 'now' : 'no longer'} an admin`,
      color: 'success',
    })
    await loadUsers()
  } catch (err) {
    toast.add({
      title: 'Failed to update admin status',
      description: err instanceof Error ? err.message : 'Unknown error',
      color: 'error',
    })
  }
}

async function handleToggleDisable(user: UserWithSpending) {
  const willDisable = !user.disabledAt

  // Confirm before disabling
  if (willDisable) {
    const confirmed = confirm(`Are you sure you want to disable ${user.email}?`)
    if (!confirmed) return
  }

  try {
    await $fetch(`/api/admin/users/${user.userId}/disable`, {
      method: 'PATCH',
      body: { disabled: willDisable },
    })
    toast.add({
      title: willDisable ? 'User disabled' : 'User enabled',
      description: `${user.email} has been ${willDisable ? 'disabled' : 'enabled'}`,
      color: 'success',
    })
    await loadUsers()
  } catch (err) {
    toast.add({
      title: 'Failed to update user status',
      description: err instanceof Error ? err.message : 'Unknown error',
      color: 'error',
    })
  }
}

function handleUserInvited() {
  showInviteModal.value = false
  loadUsers()
}

function handleEditSaved() {
  showEditModal.value = false
  loadUsers()
}

async function handleResendInvite(user: UserWithSpending) {
  try {
    await $fetch('/api/admin/users/invite', {
      method: 'POST',
      body: { email: user.email },
    })
    toast.add({
      title: 'Invite resent',
      description: `Invitation email resent to ${user.email}`,
      color: 'success',
    })
  } catch (err) {
    toast.add({
      title: 'Failed to resend invite',
      description: err instanceof Error ? err.message : 'Unknown error',
      color: 'error',
    })
  }
}

async function handleDeleteInvite(user: UserWithSpending) {
  const confirmed = confirm(`Are you sure you want to delete the pending invite for ${user.email}?`)
  if (!confirmed) return

  try {
    await $fetch(`/api/admin/users/${user.id}/invite`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Invite deleted',
      description: `Pending invite for ${user.email} has been deleted`,
      color: 'success',
    })
    await loadUsers()
  } catch (err) {
    toast.add({
      title: 'Failed to delete invite',
      description: err instanceof Error ? err.message : 'Unknown error',
      color: 'error',
    })
  }
}
</script>
