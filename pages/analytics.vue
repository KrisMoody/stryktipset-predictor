<template>
  <UContainer class="py-8">
    <!-- Loading state -->
    <div v-if="profileLoading" class="flex justify-center py-16">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>

    <!-- Access Denied -->
    <div v-else-if="accessDenied" class="text-center py-16">
      <UIcon name="i-heroicons-shield-exclamation" class="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h1 class="text-2xl font-bold mb-2">Access Denied</h1>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        You don't have permission to access this page.
      </p>
      <UButton to="/" color="primary">Go to Home</UButton>
    </div>

    <!-- Admin Content -->
    <template v-else>
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
              <p class="text-3xl font-bold text-green-700 dark:text-green-400">
                {{ stats.correctPredictions }}
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Accuracy</p>
              <p class="text-3xl font-bold">{{ stats.accuracy?.toFixed(1) ?? '0.0' }}%</p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Avg Probability Score</p>
              <p class="text-3xl font-bold">
                {{ ((stats.averageProbabilityScore ?? 0) * 100).toFixed(1) }}%
              </p>
            </div>
          </div>
        </UCard>

        <!-- Accuracy Progression -->
        <UCard>
          <template #header>
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 class="text-2xl font-semibold">Accuracy Progression</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Track prediction accuracy trends over time
                </p>
              </div>
              <div class="flex items-center gap-3">
                <USelect
                  v-model="selectedGameType"
                  :items="gameTypeOptions"
                  size="sm"
                  class="w-40"
                  aria-label="Filter by game type"
                />
                <UButton
                  icon="i-heroicons-arrow-path"
                  size="xs"
                  color="neutral"
                  :loading="refreshingProgression"
                  @click="refreshProgression"
                >
                  Refresh
                </UButton>
              </div>
            </div>
          </template>

          <div v-if="progressionPending" class="flex justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>

          <div v-else-if="progressionData" class="space-y-6">
            <!-- Period Comparison -->
            <div
              v-if="progressionData.periodComparison"
              class="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p class="text-sm text-gray-600 dark:text-gray-400">Last 30 Days</p>
                <p class="text-2xl font-bold">
                  {{ progressionData.periodComparison.current.accuracy.toFixed(1) }}%
                </p>
                <p class="text-xs text-gray-500">
                  {{ progressionData.periodComparison.current.sampleCount }} predictions
                </p>
              </div>
              <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p class="text-sm text-gray-600 dark:text-gray-400">Previous 30 Days</p>
                <p class="text-2xl font-bold">
                  {{ progressionData.periodComparison.previous.accuracy.toFixed(1) }}%
                </p>
                <p class="text-xs text-gray-500">
                  {{ progressionData.periodComparison.previous.sampleCount }} predictions
                </p>
              </div>
              <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p class="text-sm text-gray-600 dark:text-gray-400">Trend</p>
                <div class="flex items-center gap-2">
                  <UIcon
                    :name="getTrendIcon(progressionData.periodComparison.trend)"
                    :class="getTrendClass(progressionData.periodComparison.trend)"
                    class="w-6 h-6"
                  />
                  <span
                    class="text-xl font-semibold capitalize"
                    :class="getTrendClass(progressionData.periodComparison.trend)"
                  >
                    {{ progressionData.periodComparison.trend }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-1">
                  {{ getTrendDescription(progressionData.periodComparison) }}
                </p>
              </div>
            </div>

            <!-- Weekly Chart -->
            <div v-if="progressionData.weekly.length >= 2" class="h-64">
              <canvas ref="progressionChartCanvas" />
            </div>

            <div
              v-else
              class="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <UIcon name="i-heroicons-chart-bar" class="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Insufficient data for progression chart</p>
              <p class="text-sm mt-1">At least 2 weeks of prediction data required</p>
            </div>

            <!-- Rolling Average -->
            <div
              v-if="progressionData.rollingAverage !== null"
              class="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg"
            >
              <span class="text-sm font-medium text-primary-700 dark:text-primary-300">
                30-Day Rolling Average
              </span>
              <span class="text-lg font-bold text-primary-700 dark:text-primary-300">
                {{ progressionData.rollingAverage.toFixed(1) }}%
              </span>
            </div>
          </div>

          <div v-else class="text-center py-8 text-gray-500">
            <p>No progression data available yet.</p>
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
                <UBadge
                  :color="getConfidenceColor(String(confidence))"
                  variant="subtle"
                  class="mb-2"
                >
                  {{ String(confidence).toUpperCase() }}
                </UBadge>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ data.correct }} / {{ data.total }} predictions
                </p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold">{{ data.accuracy?.toFixed(1) ?? '0.0' }}%</p>
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
              <div class="text-2xl font-semibold mb-1">
                {{ data.accuracy?.toFixed(1) ?? '0.0' }}%
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ data.correct }} / {{ data.total }} correct
              </p>
            </div>
          </div>
        </UCard>

        <!-- Statistical Model Performance -->
        <UCard>
          <template #header>
            <div class="flex justify-between items-center">
              <h2 class="text-2xl font-semibold">Statistical Model Performance</h2>
              <UButton
                icon="i-heroicons-arrow-path"
                size="xs"
                color="neutral"
                :loading="refreshingModel"
                @click="refreshModelPerformance"
              >
                Refresh
              </UButton>
            </div>
          </template>

          <div v-if="modelPerformance" class="space-y-6">
            <!-- Main Metrics -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Matches Analyzed</p>
                <p class="text-3xl font-bold">
                  {{ modelPerformance.totalMatches }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Model Accuracy</p>
                <p class="text-3xl font-bold text-primary-600 dark:text-primary-400">
                  {{ modelPerformance.modelAccuracy?.toFixed(1) ?? '0.0' }}%
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Brier Score</p>
                <p class="text-3xl font-bold">
                  {{ modelPerformance.brierScore ? modelPerformance.brierScore.toFixed(3) : '-' }}
                </p>
                <p class="text-xs text-gray-500">(lower is better)</p>
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Value Bet Hit Rate</p>
                <p
                  class="text-3xl font-bold"
                  :class="
                    (modelPerformance.valueOpportunities?.hitRate ?? 0) > 33
                      ? 'text-green-600 dark:text-green-400'
                      : ''
                  "
                >
                  {{ modelPerformance.valueOpportunities?.hitRate?.toFixed(1) ?? '0.0' }}%
                </p>
                <p class="text-xs text-gray-500">
                  {{ modelPerformance.valueOpportunities?.correct ?? 0 }}/{{
                    modelPerformance.valueOpportunities?.total ?? 0
                  }}
                  value bets
                </p>
              </div>
            </div>

            <!-- Calibration Chart -->
            <div v-if="modelPerformance.calibration.length > 0">
              <h3 class="text-lg font-semibold mb-3">Calibration</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                How well do model probabilities match actual outcomes?
              </p>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th class="px-3 py-2 text-left">Probability Range</th>
                      <th class="px-3 py-2 text-center">Avg Predicted</th>
                      <th class="px-3 py-2 text-center">Actual Win Rate</th>
                      <th class="px-3 py-2 text-center">Samples</th>
                      <th class="px-3 py-2 text-center">Calibration</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                    <tr v-for="bucket in modelPerformance.calibration" :key="bucket.range">
                      <td class="px-3 py-2">{{ bucket.range }}</td>
                      <td class="px-3 py-2 text-center">
                        {{ ((bucket.predicted ?? 0) * 100).toFixed(1) }}%
                      </td>
                      <td class="px-3 py-2 text-center">
                        {{ ((bucket.actual ?? 0) * 100).toFixed(1) }}%
                      </td>
                      <td class="px-3 py-2 text-center">{{ bucket.count }}</td>
                      <td class="px-3 py-2 text-center">
                        <span :class="getCalibrationClass(bucket.predicted, bucket.actual)">
                          {{ getCalibrationDiff(bucket.predicted, bucket.actual) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8 text-gray-500">
            <p>No model performance data available yet.</p>
            <p class="text-sm mt-1">
              Run the backfill script to calculate statistics for completed matches.
            </p>
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
              <p class="text-3xl font-bold text-green-700 dark:text-green-400">
                {{ scraperHealth.last24Hours.success }}
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Failed</p>
              <p class="text-3xl font-bold text-red-700 dark:text-red-400">
                {{ scraperHealth.last24Hours.failed }}
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
              <p class="text-3xl font-bold">
                {{ scraperHealth.last24Hours?.successRate?.toFixed(1) ?? '0.0' }}%
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UContainer>
</template>

<script setup lang="ts">
import { Chart, registerables } from 'chart.js'
import type { Chart as ChartType } from 'chart.js'
import { useUserProfile } from '~/composables/useUserProfile'

Chart.register(...registerables)

definePageMeta({})

// Admin access check
const { isAdmin, fetchProfile, loading: profileLoading } = useUserProfile()
const accessDenied = ref(false)

// Check admin access on mount
onMounted(async () => {
  await fetchProfile()
  if (!isAdmin.value) {
    accessDenied.value = true
  }
})

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

interface CalibrationBucket {
  range: string
  predicted: number
  actual: number
  count: number
}

interface ModelPerformanceData {
  totalMatches: number
  modelAccuracy: number
  brierScore: number | null
  valueOpportunities: {
    total: number
    correct: number
    hitRate: number
    roi: string | number
  }
  calibration: CalibrationBucket[]
}

interface WeeklyDataPoint {
  week: string
  weekStart: string
  accuracy: number
  brierScore: number | null
  sampleCount: number
  correctCount: number
}

interface PeriodComparison {
  current: {
    accuracy: number
    brierScore: number | null
    sampleCount: number
  }
  previous: {
    accuracy: number
    brierScore: number | null
    sampleCount: number
  }
  trend: 'improving' | 'declining' | 'stable'
}

interface ProgressionData {
  weekly: WeeklyDataPoint[]
  rollingAverage: number | null
  periodComparison: PeriodComparison
}

useHead({
  title: 'Analytics - Stryktipset AI Predictor',
})

const refreshingHealth = ref(false)
const refreshingModel = ref(false)
const refreshingProgression = ref(false)

// Game type filter
const selectedGameType = ref<string | undefined>(undefined)
const gameTypeOptions = [
  { value: undefined, label: 'All Games' },
  { value: 'stryktipset', label: 'Stryktipset' },
  { value: 'europatipset', label: 'Europatipset' },
  { value: 'topptipset', label: 'Topptipset' },
]

// Chart refs
const progressionChartCanvas = ref<HTMLCanvasElement | null>(null)
let progressionChartInstance: ChartType | null = null

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

// Model performance data
const { data: modelResponse, refresh: refreshModelData } = await useFetch<{
  success: boolean
  data?: ModelPerformanceData
}>('/api/admin/model-performance')
const modelPerformance = computed(() => modelResponse.value?.data)

const refreshModelPerformance = async () => {
  refreshingModel.value = true
  try {
    await refreshModelData()
  } finally {
    refreshingModel.value = false
  }
}

// Progression data
const progressionQueryParams = computed(() => {
  const params: Record<string, string> = {}
  if (selectedGameType.value) {
    params.gameType = selectedGameType.value
  }
  return params
})

const {
  data: progressionResponse,
  pending: progressionPending,
  refresh: refreshProgressionData,
} = await useFetch<{
  success: boolean
  data?: ProgressionData
}>('/api/performance/progression', {
  query: progressionQueryParams,
})
const progressionData = computed(() => progressionResponse.value?.data)

const refreshProgression = async () => {
  refreshingProgression.value = true
  try {
    await refreshProgressionData()
  } finally {
    refreshingProgression.value = false
  }
}

// Refresh when game type changes
watch(selectedGameType, () => {
  refreshProgressionData()
})

// Chart rendering
function renderProgressionChart() {
  if (
    !progressionChartCanvas.value ||
    !progressionData.value ||
    progressionData.value.weekly.length < 2
  ) {
    return
  }

  // Destroy existing chart
  if (progressionChartInstance) {
    progressionChartInstance.destroy()
  }

  const ctx = progressionChartCanvas.value.getContext('2d')
  if (!ctx) return

  const weekly = progressionData.value.weekly
  const labels = weekly.map(d => d.week)
  const accuracyData = weekly.map(d => d.accuracy)

  progressionChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Weekly Accuracy',
          data: accuracyData,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        ...(progressionData.value.rollingAverage !== null
          ? [
              {
                label: '30-Day Average',
                data: accuracyData.map(() => progressionData.value!.rollingAverage),
                borderColor: 'rgb(34, 197, 94)',
                borderDash: [5, 5],
                tension: 0,
                fill: false,
                pointRadius: 0,
              },
            ]
          : []),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: context => {
              const yValue = context.parsed.y ?? 0
              const dataPoint = weekly[context.dataIndex]
              if (context.datasetIndex === 0 && dataPoint) {
                return `Accuracy: ${yValue.toFixed(1)}% (${dataPoint.correctCount}/${dataPoint.sampleCount})`
              }
              return `${context.dataset.label}: ${yValue.toFixed(1)}%`
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          min: Math.max(0, Math.min(...accuracyData) - 10),
          max: Math.min(100, Math.max(...accuracyData) + 10),
          ticks: {
            callback: value => `${value}%`,
          },
        },
      },
    },
  })
}

// Watch for data changes and re-render chart
watch(
  () => progressionData.value,
  () => {
    nextTick(() => {
      renderProgressionChart()
    })
  },
  { deep: true }
)

onMounted(() => {
  nextTick(() => {
    renderProgressionChart()
  })
})

onUnmounted(() => {
  if (progressionChartInstance) {
    progressionChartInstance.destroy()
  }
})

// Trend helpers
function getTrendIcon(trend: string): string {
  switch (trend) {
    case 'improving':
      return 'i-heroicons-arrow-trending-up'
    case 'declining':
      return 'i-heroicons-arrow-trending-down'
    default:
      return 'i-heroicons-minus'
  }
}

function getTrendClass(trend: string): string {
  switch (trend) {
    case 'improving':
      return 'text-green-600 dark:text-green-400'
    case 'declining':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

function getTrendDescription(comparison: PeriodComparison): string {
  const diff = comparison.current.accuracy - comparison.previous.accuracy
  if (Math.abs(diff) < 2) {
    return 'Accuracy is stable'
  }
  const direction = diff > 0 ? 'up' : 'down'
  return `${Math.abs(diff).toFixed(1)}% ${direction} from previous period`
}

const getCalibrationClass = (predicted: number, actual: number): string => {
  const diff = Math.abs(predicted - actual)
  if (diff < 0.05) return 'text-green-600 dark:text-green-400'
  if (diff < 0.1) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

const getCalibrationDiff = (predicted: number, actual: number): string => {
  const diff = (actual - predicted) * 100
  const sign = diff >= 0 ? '+' : ''
  return `${sign}${diff.toFixed(1)}%`
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
