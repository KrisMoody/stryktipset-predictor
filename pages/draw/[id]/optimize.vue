<template>
  <div class="p-6">
    <!-- Breadcrumb -->
    <AppBreadcrumb />

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          Optimize Coupon - Draw #{{ drawId }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ gameDisplayName }} • Generate optimal betting coupon
        </p>
      </div>
      <UButton :to="{ path: `/draw/${drawId}`, query: { gameType } }" variant="ghost">
        <UIcon name="i-heroicons-arrow-left" class="w-4 h-4 mr-1" />
        Back to Draw
      </UButton>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="flex justify-center py-12">
      <div class="text-center">
        <div
          class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto mb-3"
        />
        <p class="text-gray-500 dark:text-gray-400">Loading draw data...</p>
      </div>
    </div>

    <template v-else-if="draw">
      <!-- Step Indicator -->
      <div class="flex items-center justify-center mb-8">
        <div v-for="(step, index) in steps" :key="step.id" class="flex items-center">
          <div
            class="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium"
            :class="
              currentStep >= index
                ? 'bg-primary-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            "
          >
            {{ index + 1 }}
          </div>
          <span
            class="ml-2 text-sm"
            :class="
              currentStep >= index
                ? 'text-gray-900 dark:text-white font-medium'
                : 'text-gray-500 dark:text-gray-400'
            "
          >
            {{ step.label }}
          </span>
          <div
            v-if="index < steps.length - 1"
            class="w-12 h-0.5 mx-4"
            :class="currentStep > index ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'"
          />
        </div>
      </div>

      <!-- Step 1: Predictions Preview -->
      <div v-if="currentStep === 0" class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">AI Predictions Preview</h2>
          </template>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200 dark:border-gray-700">
                  <th class="text-left py-2 font-medium text-gray-500">#</th>
                  <th class="text-left py-2 font-medium text-gray-500">Match</th>
                  <th class="text-center py-2 font-medium text-gray-500">Prediction</th>
                  <th class="text-center py-2 font-medium text-gray-500">Confidence</th>
                  <th class="text-center py-2 font-medium text-gray-500">1</th>
                  <th class="text-center py-2 font-medium text-gray-500">X</th>
                  <th class="text-center py-2 font-medium text-gray-500">2</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                <tr v-for="match in draw.matches" :key="match.id">
                  <td class="py-2 font-medium">{{ match.match_number }}</td>
                  <td class="py-2">{{ match.homeTeam.name }} vs {{ match.awayTeam.name }}</td>
                  <td class="py-2 text-center">
                    <span
                      v-if="match.predictions?.[0]"
                      class="font-bold text-primary-600 dark:text-primary-400"
                    >
                      {{ match.predictions[0].predicted_outcome }}
                    </span>
                    <span v-else class="text-gray-400">—</span>
                  </td>
                  <td class="py-2 text-center">
                    <UBadge
                      v-if="match.predictions?.[0]"
                      :color="getConfidenceColor(match.predictions[0].confidence)"
                      variant="subtle"
                      size="xs"
                    >
                      {{ match.predictions[0].confidence }}
                    </UBadge>
                  </td>
                  <td class="py-2 text-center text-gray-600 dark:text-gray-400">
                    {{ formatProb(match.predictions?.[0]?.probability_home) }}
                  </td>
                  <td class="py-2 text-center text-gray-600 dark:text-gray-400">
                    {{ formatProb(match.predictions?.[0]?.probability_draw) }}
                  </td>
                  <td class="py-2 text-center text-gray-600 dark:text-gray-400">
                    {{ formatProb(match.predictions?.[0]?.probability_away) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <template #footer>
            <div class="flex justify-end">
              <UButton color="primary" @click="currentStep = 1">
                Continue to Mode Selection
                <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 ml-1" />
              </UButton>
            </div>
          </template>
        </UCard>
      </div>

      <!-- Step 2: Mode Selection -->
      <div v-else-if="currentStep === 1" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            v-for="mode in optimizationModes"
            :key="mode.id"
            class="p-6 rounded-lg border-2 cursor-pointer transition-all"
            :class="
              selectedMode === mode.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            "
            @click="selectedMode = mode.id"
          >
            <div class="text-3xl mb-3">{{ mode.emoji }}</div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {{ mode.label }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ mode.description }}
            </p>
          </div>
        </div>

        <div class="flex justify-between">
          <UButton variant="ghost" @click="currentStep = 0">
            <UIcon name="i-heroicons-arrow-left" class="w-4 h-4 mr-1" />
            Back
          </UButton>
          <UButton color="primary" :disabled="!selectedMode" @click="currentStep = 2">
            Continue to Generate
            <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 ml-1" />
          </UButton>
        </div>
      </div>

      <!-- Step 3: Generate & Results -->
      <div v-else-if="currentStep === 2" class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Generate Coupon</h2>
          </template>

          <div class="space-y-4">
            <div class="flex items-center gap-4">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Stake:</label>
              <StakeSelector v-model="selectedStake" />
            </div>

            <UButton color="primary" size="lg" :loading="generating" @click="generateCoupon">
              Generate Optimal Coupon
            </UButton>
          </div>

          <!-- Results -->
          <div v-if="couponResult" class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <OptimizeCouponDisplay
              :coupon="couponResult"
              :draw-number="Number(drawId)"
              :game-type="gameType"
            />
          </div>
        </UCard>

        <div class="flex justify-between">
          <UButton variant="ghost" @click="currentStep = 1">
            <UIcon name="i-heroicons-arrow-left" class="w-4 h-4 mr-1" />
            Back
          </UButton>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { GameType } from '~/types/game-types'
import type { SystemCoupon, OptimalCoupon } from '~/types'
import { getGameConfig } from '~/server/constants/game-configs'

definePageMeta({})

const route = useRoute()
const drawId = route.params.id as string
const toast = useToast()

const gameType = computed(() => (route.query.gameType as GameType) || 'stryktipset')
const gameDisplayName = computed(() => getGameConfig(gameType.value).displayName)

useHead({
  title: computed(() => `Optimize Coupon - Draw #${drawId}`),
})

const steps = [
  { id: 'preview', label: 'Preview' },
  { id: 'mode', label: 'Mode' },
  { id: 'generate', label: 'Generate' },
]

type TopptipsetStake = 1 | 2 | 5 | 10

const currentStep = ref(0)
const selectedMode = ref<string | null>(null)
const selectedStake = ref<TopptipsetStake>(1)
const generating = ref(false)
const couponResult = ref<SystemCoupon | OptimalCoupon | null>(null)

const optimizationModes = [
  {
    id: 'ai',
    label: 'AI-Based',
    emoji: '🤖',
    description: 'Use AI predictions to optimize coverage based on confidence levels.',
  },
  {
    id: 'r-system',
    label: 'R-System',
    emoji: '📊',
    description: 'Traditional reduced system with guaranteed coverage.',
  },
  {
    id: 'u-system',
    label: 'U-System',
    emoji: '🎯',
    description: 'Extended system with additional coverage for uncertain matches.',
  },
]

interface Match {
  id: number
  match_number: number
  homeTeam: { name: string }
  awayTeam: { name: string }
  predictions?: {
    predicted_outcome: string
    confidence: string
    probability_home: number | string
    probability_draw: number | string
    probability_away: number | string
  }[]
}

interface Draw {
  draw_number: number
  matches?: Match[]
}

const { data: response, pending } = await useFetch<{ success: boolean; draw?: Draw }>(
  `/api/draws/${drawId}`,
  {
    query: { gameType },
    watch: [gameType],
  }
)

const draw = computed(() => response.value?.draw)

function getConfidenceColor(confidence: string) {
  switch (confidence) {
    case 'high':
      return 'success'
    case 'medium':
      return 'warning'
    case 'low':
      return 'error'
    default:
      return 'neutral'
  }
}

function formatProb(prob: number | string | undefined): string {
  if (prob === undefined) return '—'
  return `${(Number(prob) * 100).toFixed(0)}%`
}

// API response type
interface OptimizeApiResponse {
  success: boolean
  coupon: SystemCoupon | OptimalCoupon
  mode: string
  gameType: GameType
}

async function generateCoupon() {
  generating.value = true
  try {
    const result = await $fetch<OptimizeApiResponse>(`/api/draws/${drawId}/optimize`, {
      method: 'POST',
      body: {
        gameType: gameType.value,
        mode: selectedMode.value,
        stake: selectedStake.value,
      },
    })
    // Extract the coupon from the API response
    couponResult.value = result.coupon
    toast.add({
      title: 'Coupon Generated',
      description: 'Your optimal coupon has been generated',
      color: 'success',
    })
  } catch (err) {
    console.error('Error generating coupon:', err)
    toast.add({
      title: 'Generation Failed',
      description: err instanceof Error ? err.message : 'Failed to generate coupon',
      color: 'error',
    })
  } finally {
    generating.value = false
  }
}
</script>
