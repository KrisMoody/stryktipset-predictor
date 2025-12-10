<template>
  <UContainer class="py-8">
    <AppBreadcrumb />

    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2">Optimize Coupon</h1>
      <p class="text-gray-600 dark:text-gray-400">
        Generate optimal betting combinations for Draw #{{ drawId }}
      </p>
    </div>

    <!-- Multi-step wizard -->
    <div class="space-y-6">
      <!-- Step 1: AI Predictions Preview -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">Step 1: AI Predictions</h2>
            <UBadge v-if="aiPredictions" color="success" variant="soft"> Completed </UBadge>
          </div>
        </template>

        <div v-if="!aiPredictions">
          <div class="text-center py-8">
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              First, let's generate AI predictions for all matches in this draw.
            </p>
            <UButton
              :loading="loadingAI"
              size="lg"
              icon="i-heroicons-sparkles"
              color="primary"
              @click="generateAIPredictions"
            >
              Generate AI Predictions
            </UButton>
          </div>
        </div>

        <OptimizeAIPreview v-else :selections="aiPredictions" />
      </UCard>

      <!-- Step 2: Mode Selection -->
      <UCard v-if="aiPredictions">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">Step 2: Optimization Mode</h2>
            <UBadge v-if="selectedMode" color="success" variant="soft">
              {{
                selectedMode === 'ai'
                  ? 'AI-Based'
                  : selectedMode === 'r-system'
                    ? 'R-System'
                    : 'U-System'
              }}
            </UBadge>
          </div>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UCard
            :class="[
              'cursor-pointer transition-all',
              selectedMode === 'ai'
                ? 'border-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border border-gray-200 dark:border-gray-700 hover:border-primary-300',
            ]"
            @click="selectedMode = 'ai'"
          >
            <div class="text-center space-y-3">
              <div class="text-4xl">🤖</div>
              <h3 class="font-bold text-lg">AI-Based</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Simple optimization using AI predictions
              </p>
            </div>
          </UCard>

          <UCard
            :class="[
              'cursor-pointer transition-all',
              selectedMode === 'r-system'
                ? 'border-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border border-gray-200 dark:border-gray-700 hover:border-primary-300',
            ]"
            @click="selectedMode = 'r-system'"
          >
            <div class="text-center space-y-3">
              <div class="text-4xl">📊</div>
              <h3 class="font-bold text-lg">R-System</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Reduced symmetric system with guarantee
              </p>
            </div>
          </UCard>

          <UCard
            :class="[
              'cursor-pointer transition-all',
              selectedMode === 'u-system'
                ? 'border-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border border-gray-200 dark:border-gray-700 hover:border-primary-300',
            ]"
            @click="selectedMode = 'u-system'"
          >
            <div class="text-center space-y-3">
              <div class="text-4xl">🎯</div>
              <h3 class="font-bold text-lg">U-System</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Weighted reduced system with utgångstecken
              </p>
            </div>
          </UCard>
        </div>
      </UCard>

      <!-- Step 3: System Selection (for R/U modes) -->
      <UCard v-if="selectedMode && selectedMode !== 'ai'">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">Step 3: Select System</h2>
            <UBadge v-if="selectedSystem" color="success" variant="soft">
              {{ selectedSystem.id }}
            </UBadge>
          </div>
        </template>

        <OptimizeSystemSelector
          :system-type="selectedMode === 'r-system' ? 'R' : 'U'"
          :selected-system-id="selectedSystem?.id"
          @select="handleSystemSelect"
        />
      </UCard>

      <!-- Step 4: Utgångstecken Editor (for U-systems) -->
      <UCard v-if="selectedMode === 'u-system' && selectedSystem && aiPredictions">
        <template #header>
          <h2 class="text-xl font-semibold">Step 4: Set Utgångstecken</h2>
        </template>

        <OptimizeUtgangsteckenEditor
          :system="selectedSystem"
          :ai-predictions="aiPredictions"
          :utgangstecken="utgangstecken"
          @update="handleUtgangsteckenUpdate"
        />
      </UCard>

      <!-- Step 5: MG Extensions (optional, for R/U systems) -->
      <UCard
        v-if="
          selectedSystem &&
          aiPredictions &&
          (selectedMode === 'r-system' ||
            (selectedMode === 'u-system' && Object.keys(utgangstecken).length > 0))
        "
      >
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">
              Step {{ selectedMode === 'u-system' ? '5' : '4' }}: MG Extensions (Optional)
            </h2>
            <UBadge v-if="mgExtensions.length > 0" color="primary" variant="soft">
              {{ mgExtensions.length }} extension{{ mgExtensions.length > 1 ? 's' : '' }}
            </UBadge>
          </div>
        </template>

        <OptimizeMGExtensionEditor
          :system="selectedSystem"
          :ai-predictions="aiPredictions"
          :current-coverage="currentCoverage"
          :extensions="mgExtensions"
          @update="handleMGExtensionsUpdate"
        />
      </UCard>

      <!-- Step 6: Generate & Display -->
      <UCard v-if="canGenerate">
        <template #header>
          <h2 class="text-xl font-semibold">
            {{ generatedCoupon ? 'Generated Coupon' : 'Generate Coupon' }}
          </h2>
        </template>

        <div v-if="!generatedCoupon" class="text-center py-8">
          <p class="text-gray-600 dark:text-gray-400 mb-4">
            Ready to generate your optimized coupon!
          </p>
          <UButton
            :loading="generating"
            size="lg"
            color="primary"
            icon="i-heroicons-rocket-launch"
            @click="generateCoupon"
          >
            Generate Coupon
          </UButton>
        </div>

        <div v-else>
          <OptimizeCouponDisplay
            :coupon="generatedCoupon"
            :coupon-id="couponId ?? undefined"
            :coupon-status="couponStatus"
            :game-type="gameType"
            @status-updated="handleStatusUpdated"
          />

          <div class="mt-6 text-center">
            <UButton variant="outline" icon="i-heroicons-arrow-path" @click="resetAndRegenerate">
              Generate New Coupon
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type {
  BettingSystem,
  CouponSelection,
  SystemCoupon,
  OptimalCoupon,
  MGExtension,
  CouponStatus,
} from '~/types'
import type { GameType } from '~/types/game-types'
import { getGameConfig } from '~/server/constants/game-configs'

const route = useRoute()
const drawId = route.params.id as string

// Extract gameType from query parameter, default to stryktipset
const gameType = computed(() => (route.query.gameType as GameType) || 'stryktipset')
const gameDisplayName = computed(() => getGameConfig(gameType.value).displayName)

// State
const aiPredictions = ref<CouponSelection[] | null>(null)
const selectedMode = ref<'ai' | 'r-system' | 'u-system' | null>(null)
const selectedSystem = ref<BettingSystem | null>(null)
const utgangstecken = ref<Record<number, string>>({})
const mgExtensions = ref<MGExtension[]>([])
const generatedCoupon = ref<SystemCoupon | OptimalCoupon | null>(null)
const loadingAI = ref(false)
const generating = ref(false)

// Coupon persistence state
const couponId = ref<number | null>(null)
const couponStatus = ref<CouponStatus>('generated')

// Computed
const canGenerate = computed(() => {
  if (selectedMode.value === 'ai') return true
  if (selectedMode.value === 'r-system') return !!selectedSystem.value
  if (selectedMode.value === 'u-system') {
    const system = selectedSystem.value
    if (!system) return false
    const requiredCount = system.helgarderingar + system.halvgarderingar
    return Object.keys(utgangstecken.value).length >= requiredCount
  }
  return false
})

// Calculate current coverage per match based on system configuration
const currentCoverage = computed((): Record<number, string[]> => {
  if (!selectedSystem.value || !aiPredictions.value) return {}

  const coverage: Record<number, string[]> = {}
  const system = selectedSystem.value

  // Sort predictions by EV to determine spiks vs hedges
  const sorted = [...aiPredictions.value].sort((a, b) => b.expected_value - a.expected_value)

  // Top EVs are spiks (single outcome)
  const gameMatchCount = getGameConfig(gameType.value).matchCount
  const spikCount = gameMatchCount - system.helgarderingar - system.halvgarderingar
  const spiks = sorted.slice(0, spikCount)
  const helgMatches = sorted.slice(spikCount, spikCount + system.helgarderingar)
  const halvgMatches = sorted.slice(spikCount + system.helgarderingar)

  // Spiks: single outcome (AI's top pick)
  spiks.forEach(match => {
    const outcome = match.selection.length === 1 ? match.selection : match.selection[0] || '1'
    coverage[match.matchNumber] = [outcome]
  })

  // Helgarderingar: all 3 outcomes
  helgMatches.forEach(match => {
    coverage[match.matchNumber] = ['1', 'X', '2']
  })

  // Halvgarderingar: 2 outcomes
  halvgMatches.forEach(match => {
    // For now, assume top 2 probable outcomes
    const selection = match.selection
    if (selection.length >= 2) {
      // If selection is a string like "1X", split it; if it's already an array-like, slice it
      const first = selection[0] || '1'
      const second = selection[1] || 'X'
      coverage[match.matchNumber] = [first, second]
    } else {
      // Default to AI prediction + most likely alternative
      coverage[match.matchNumber] = [selection[0] || '1', 'X']
    }
  })

  return coverage
})

// Methods
const generateAIPredictions = async () => {
  loadingAI.value = true
  try {
    const response = await $fetch<{ success: boolean; coupon?: OptimalCoupon }>(
      `/api/draws/${drawId}/optimize`,
      {
        method: 'POST',
        body: { mode: 'ai', budget: 500, gameType: gameType.value },
      }
    )

    if (response?.coupon?.selections) {
      aiPredictions.value = response.coupon.selections
    }
  } catch (error) {
    console.error('Failed to generate AI predictions:', error)
  } finally {
    loadingAI.value = false
  }
}

const handleSystemSelect = (system: BettingSystem) => {
  selectedSystem.value = system
  // Reset utgångstecken when system changes
  utgangstecken.value = {}
}

const handleUtgangsteckenUpdate = (newUtgangstecken: Record<number, string>) => {
  utgangstecken.value = newUtgangstecken
}

const handleMGExtensionsUpdate = (newExtensions: MGExtension[]) => {
  mgExtensions.value = newExtensions
}

const generateCoupon = async () => {
  generating.value = true
  try {
    const body: Record<string, unknown> = {
      gameType: gameType.value,
    }

    if (selectedMode.value === 'r-system' || selectedMode.value === 'u-system') {
      body.mode = 'system'
      body.systemId = selectedSystem.value?.id
      if (selectedMode.value === 'u-system') {
        body.utgangstecken = utgangstecken.value
      }
      // Include MG extensions if any
      if (mgExtensions.value.length > 0) {
        body.mgExtensions = mgExtensions.value
      }
    } else if (selectedMode.value === 'ai') {
      body.mode = 'ai'
      body.budget = 500
    }

    const response = await $fetch<{
      success: boolean
      coupon?: (SystemCoupon | OptimalCoupon) & {
        id: number
        status: CouponStatus
        version: number
      }
    }>(`/api/draws/${drawId}/optimize`, {
      method: 'POST',
      body,
    })

    if (response?.coupon) {
      generatedCoupon.value = response.coupon
      couponId.value = response.coupon.id
      couponStatus.value = response.coupon.status
    }
  } catch (error) {
    console.error('Failed to generate coupon:', error)
  } finally {
    generating.value = false
  }
}

const resetAndRegenerate = () => {
  generatedCoupon.value = null
  couponId.value = null
  couponStatus.value = 'generated'
}

const handleStatusUpdated = (status: CouponStatus) => {
  couponStatus.value = status
}

useHead({
  title: computed(
    () => `Optimize Coupon - Draw #${drawId} - ${gameDisplayName.value} AI Predictor`
  ),
})
</script>
