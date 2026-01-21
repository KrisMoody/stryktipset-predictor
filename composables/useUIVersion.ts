const UI_PREFERENCE_KEY = 'st-predictor-ui-preference'
const BANNER_DISMISSED_KEY = 'st-predictor-v2-banner-dismissed'

type UIPreference = 'v1' | 'v2' | null

/**
 * Composable for managing UI version preference.
 * Combines feature flag with user's localStorage preference.
 */
export function useUIVersion() {
  const config = useRuntimeConfig()

  // Feature flag - when true, V2 is available
  const isV2Available = computed(() => config.public.enableUIV2 === true)

  // User's stored preference (null = no preference set)
  const userPreference = useState<UIPreference>('ui-preference', () => null)

  // Whether the "try new UI" banner has been dismissed
  const bannerDismissed = useState<boolean>('v2-banner-dismissed', () => false)

  // Load preference from localStorage on client
  onMounted(() => {
    if (import.meta.client) {
      const stored = localStorage.getItem(UI_PREFERENCE_KEY) as UIPreference
      if (stored === 'v1' || stored === 'v2') {
        userPreference.value = stored
      }

      const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY)
      bannerDismissed.value = dismissed === 'true'
    }
  })

  // Should use V2 UI: feature flag enabled AND (user prefers V2 OR no preference with flag forcing V2)
  const shouldUseV2 = computed(() => {
    if (!isV2Available.value) return false
    // If user explicitly chose v1, respect that
    if (userPreference.value === 'v1') return false
    // If user chose v2 or no preference set, use v2
    return userPreference.value === 'v2' || userPreference.value === null
  })

  // Show banner: V2 available, user hasn't chosen yet, and banner not dismissed
  const showV2Banner = computed(() => {
    return isV2Available.value && userPreference.value === null && !bannerDismissed.value
  })

  // Set user preference
  function setPreference(preference: 'v1' | 'v2') {
    userPreference.value = preference
    if (import.meta.client) {
      localStorage.setItem(UI_PREFERENCE_KEY, preference)
    }
  }

  // Dismiss the banner without setting a preference
  function dismissBanner() {
    bannerDismissed.value = true
    if (import.meta.client) {
      localStorage.setItem(BANNER_DISMISSED_KEY, 'true')
    }
  }

  // Reset preference (for settings page)
  function resetPreference() {
    userPreference.value = null
    bannerDismissed.value = false
    if (import.meta.client) {
      localStorage.removeItem(UI_PREFERENCE_KEY)
      localStorage.removeItem(BANNER_DISMISSED_KEY)
    }
  }

  // Legacy: isV2 now checks shouldUseV2
  const isV2 = shouldUseV2

  return {
    isV2,
    isV2Available,
    userPreference,
    shouldUseV2,
    showV2Banner,
    setPreference,
    dismissBanner,
    resetPreference,
  }
}
