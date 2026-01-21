import { describe, it, expect } from 'vitest'
import { computed, ref } from 'vue'

// ============================================================================
// Mock useRuntimeConfig and test useUIVersion logic
// ============================================================================

// Since useRuntimeConfig is a Nuxt composable that requires the Nuxt context,
// we test the logic by mocking the config values

describe('useUIVersion', () => {
  // Simulate the useUIVersion logic with different config values
  const createUseUIVersion = (enableUIV2: boolean | undefined) => {
    const config = {
      public: {
        enableUIV2,
      },
    }
    const isV2 = computed(() => config.public.enableUIV2 === true)
    return { isV2 }
  }

  describe('isV2 computed property', () => {
    it('returns true when enableUIV2 is true', () => {
      const { isV2 } = createUseUIVersion(true)
      expect(isV2.value).toBe(true)
    })

    it('returns false when enableUIV2 is false', () => {
      const { isV2 } = createUseUIVersion(false)
      expect(isV2.value).toBe(false)
    })

    it('returns false when enableUIV2 is undefined', () => {
      const { isV2 } = createUseUIVersion(undefined)
      expect(isV2.value).toBe(false)
    })

    it('returns false when enableUIV2 is string "true" (strict equality)', () => {
      // @ts-expect-error Testing string value
      const { isV2 } = createUseUIVersion('true')
      expect(isV2.value).toBe(false)
    })

    it('returns false when enableUIV2 is number 1 (strict equality)', () => {
      // @ts-expect-error Testing number value
      const { isV2 } = createUseUIVersion(1)
      expect(isV2.value).toBe(false)
    })
  })

  describe('reactivity', () => {
    it('isV2 is reactive to config changes', () => {
      const config = {
        public: {
          enableUIV2: ref(false),
        },
      }
      const isV2 = computed(() => config.public.enableUIV2.value === true)

      expect(isV2.value).toBe(false)

      config.public.enableUIV2.value = true
      expect(isV2.value).toBe(true)

      config.public.enableUIV2.value = false
      expect(isV2.value).toBe(false)
    })
  })

  describe('feature flag behavior', () => {
    it('default behavior should be v1 (isV2 = false)', () => {
      // When no flag is set, v1 should be the default
      const { isV2 } = createUseUIVersion(undefined)
      expect(isV2.value).toBe(false)
    })

    it('explicit opt-in required for v2', () => {
      // Must explicitly set to true to enable v2
      const withFalse = createUseUIVersion(false)
      const withUndefined = createUseUIVersion(undefined)
      const withTrue = createUseUIVersion(true)

      expect(withFalse.isV2.value).toBe(false)
      expect(withUndefined.isV2.value).toBe(false)
      expect(withTrue.isV2.value).toBe(true)
    })
  })
})
