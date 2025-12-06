<template>
  <UContainer class="py-8">
    <AppBreadcrumb />

    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2">Prediction Analytics</h1>
      <p class="text-gray-600 dark:text-gray-400">Track AI prediction performance over time</p>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <div class="text-center">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"
        />
        <p class="text-gray-600 dark:text-gray-400">Loading analytics...</p>
      </div>
    </div>

    <div v-else-if="stats" class="space-y-6">
      <!-- Overall Stats -->
      <UCard>
        <template #header>
          <h2 class="text-2xl font-semibold">Overall Performance</h2>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Total Predictions</p>
            <p class="text-3xl font-bold">
              {{ stats.totalPredictions }}
            </p>
          </div>
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Correct</p>
            <p class="text-3xl font-bold text-green-500">
              {{ stats.correctPredictions }}
            </p>
          </div>
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Accuracy</p>
            <p class="text-3xl font-bold">{{ stats.accuracy.toFixed(1) }}%</p>
          </div>
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Avg Probability Score</p>
            <p class="text-3xl font-bold">
              {{ (stats.averageProbabilityScore * 100).toFixed(1) }}%
            </p>
          </div>
        </div>
      </UCard>

      <!-- By Confidence -->
      <UCard v-if="Object.keys(stats.byConfidence).length > 0">
        <template #header>
          <h2 class="text-2xl font-semibold">Performance by Confidence Level</h2>
        </template>

        <div class="space-y-4">
          <div
            v-for="(data, confidence) in stats.byConfidence"
            :key="confidence"
            class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div>
              <UBadge :color="getConfidenceColor(String(confidence))" variant="subtle" class="mb-2">
                {{ String(confidence).toUpperCase() }}
              </UBadge>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ data.correct }} / {{ data.total }} predictions
              </p>
            </div>
            <div class="text-right">
              <p class="text-2xl font-bold">{{ data.accuracy.toFixed(1) }}%</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">accuracy</p>
            </div>
          </div>
        </div>
      </UCard>

      <!-- By Outcome -->
      <UCard v-if="Object.keys(stats.byOutcome).length > 0">
        <template #header>
          <h2 class="text-2xl font-semibold">Performance by Predicted Outcome</h2>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            v-for="(data, outcome) in stats.byOutcome"
            :key="outcome"
            class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center"
          >
            <div class="text-3xl font-bold mb-2">
              {{ outcome }}
            </div>
            <div class="text-2xl font-semibold mb-1">{{ data.accuracy.toFixed(1) }}%</div>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ data.correct }} / {{ data.total }} correct
            </p>
          </div>
        </div>
      </UCard>

      <!-- Scraper Health -->
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <h2 class="text-2xl font-semibold">Scraper Health (Last 24h)</h2>
            <UButton
              icon="i-heroicons-arrow-path"
              size="xs"
              color="neutral"
              :loading="refreshingHealth"
              @click="refreshHealth"
            >
              Refresh
            </UButton>
          </div>
        </template>

        <div v-if="scraperHealth" class="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Total Operations</p>
            <p class="text-3xl font-bold">
              {{ scraperHealth.last24Hours.total }}
            </p>
          </div>
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Successful</p>
            <p class="text-3xl font-bold text-green-500">
              {{ scraperHealth.last24Hours.success }}
            </p>
          </div>
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Failed</p>
            <p class="text-3xl font-bold text-red-500">
              {{ scraperHealth.last24Hours.failed }}
            </p>
          </div>
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
            <p class="text-3xl font-bold">
              {{ scraperHealth.last24Hours.successRate.toFixed(1) }}%
            </p>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
interface ConfidenceData {
  correct: number
  total: number
  accuracy: number
}

interface OutcomeData {
  correct: number
  total: number
  accuracy: number
}

interface StatsData {
  totalPredictions: number
  correctPredictions: number
  accuracy: number
  averageProbabilityScore: number
  byConfidence: Record<string, ConfidenceData>
  byOutcome: Record<string, OutcomeData>
}

interface ScraperHealthData {
  last24Hours: {
    total: number
    success: number
    failed: number
    successRate: number
  }
}

useHead({
  title: 'Analytics - Stryktipset AI Predictor',
})

const refreshingHealth = ref(false)

const { data: response, pending } = await useFetch<{
  success: boolean
  stats?: StatsData
  error?: string
}>('/api/performance/summary')
const stats = computed(() => response.value?.stats)

const { data: healthResponse, refresh: refreshHealthData } = await useFetch<{
  success: boolean
  health?: ScraperHealthData
  error?: string
}>('/api/admin/scraper-health')
const scraperHealth = computed(() => healthResponse.value?.health)

const refreshHealth = async () => {
  refreshingHealth.value = true
  try {
    await refreshHealthData()
  } finally {
    refreshingHealth.value = false
  }
}

const getConfidenceColor = (confidence: string) => {
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
</script>
