import { ref, computed } from 'vue'

export interface UserProfileData {
  id: number
  userId: string
  email: string
  isAdmin: boolean
  costCapUsd: number
  capBypassUntil: string | null
  currentWeekSpending: number
  remainingBudget: number | null
  hasBypass: boolean
  createdAt: string
  updatedAt: string
}

interface ProfileResponse {
  success: boolean
  profile: UserProfileData
}

const profile = ref<UserProfileData | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

// Mock profile for test mode
const mockTestProfile: UserProfileData = {
  id: 1,
  userId: 'test-user-id',
  email: 'test@example.com',
  isAdmin: true,
  costCapUsd: 100,
  capBypassUntil: null,
  currentWeekSpending: 0,
  remainingBudget: 100,
  hasBypass: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export function useUserProfile() {
  // In test mode, return mock admin profile
  const config = useRuntimeConfig()
  if (config.public.testMode) {
    profile.value = mockTestProfile
  }

  const isAdmin = computed(() => profile.value?.isAdmin ?? false)
  const hasProfile = computed(() => profile.value !== null)

  async function fetchProfile(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<ProfileResponse>('/api/user/profile')
      if (response.success) {
        profile.value = response.profile
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch profile'
      console.error('Failed to fetch user profile:', err)
    } finally {
      loading.value = false
    }
  }

  function clearProfile(): void {
    profile.value = null
    error.value = null
  }

  return {
    profile,
    loading,
    error,
    isAdmin,
    hasProfile,
    fetchProfile,
    clearProfile,
  }
}
