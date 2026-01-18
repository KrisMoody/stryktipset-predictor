<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-6 text-red-500 dark:text-red-400">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 mx-auto mb-2" />
      <p class="text-sm">{{ error }}</p>
    </div>

    <!-- No Data State -->
    <div v-else-if="!calculations" class="text-center py-6 text-gray-500 dark:text-gray-400">
      <UIcon name="i-heroicons-calculator" class="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p class="text-sm">Model data unavailable for this match.</p>
      <p class="text-xs mt-1">Calculations will be available after the draw is synced.</p>
    </div>

    <!-- Model Analysis Content -->
    <template v-else>
      <!-- Probability Comparison -->
      <div>
        <h4
          class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"
        >
          <UIcon name="i-heroicons-chart-pie" class="w-4 h-4" aria-hidden="true" />
          Probability Comparison
        </h4>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                  Outcome
                </th>
                <th
                  class="px-3 py-2 text-center font-medium text-primary-600 dark:text-primary-400"
                >
                  Model
                </th>
                <th class="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">
                  Market
                </th>
                <th class="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">
                  Diff
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr>
                <td class="px-3 py-2 font-medium">Home (1)</td>
                <td
                  class="px-3 py-2 text-center font-semibold text-primary-600 dark:text-primary-400"
                >
                  {{ formatPercent(calculations.modelProbabilities.home) }}
                </td>
                <td class="px-3 py-2 text-center">
                  {{ marketProbabilities ? formatPercent(marketProbabilities.home) : '-' }}
                </td>
                <td class="px-3 py-2 text-center" :class="getDiffClass(probDiff.home)">
                  {{ formatDiff(probDiff.home) }}
                </td>
              </tr>
              <tr>
                <td class="px-3 py-2 font-medium">Draw (X)</td>
                <td
                  class="px-3 py-2 text-center font-semibold text-primary-600 dark:text-primary-400"
                >
                  {{ formatPercent(calculations.modelProbabilities.draw) }}
                </td>
                <td class="px-3 py-2 text-center">
                  {{ marketProbabilities ? formatPercent(marketProbabilities.draw) : '-' }}
                </td>
                <td class="px-3 py-2 text-center" :class="getDiffClass(probDiff.draw)">
                  {{ formatDiff(probDiff.draw) }}
                </td>
              </tr>
              <tr>
                <td class="px-3 py-2 font-medium">Away (2)</td>
                <td
                  class="px-3 py-2 text-center font-semibold text-primary-600 dark:text-primary-400"
                >
                  {{ formatPercent(calculations.modelProbabilities.away) }}
                </td>
                <td class="px-3 py-2 text-center">
                  {{ marketProbabilities ? formatPercent(marketProbabilities.away) : '-' }}
                </td>
                <td class="px-3 py-2 text-center" :class="getDiffClass(probDiff.away)">
                  {{ formatDiff(probDiff.away) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Expected Goals and Margin -->
        <div class="mt-3 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span>
            <strong>Expected Goals:</strong>
            {{ homeTeamName }} {{ calculations.expectedGoals.home.toFixed(2) }} -
            {{ calculations.expectedGoals.away.toFixed(2) }} {{ awayTeamName }}
          </span>
          <span>
            <strong>Bookmaker Margin:</strong> {{ formatPercent(calculations.bookmakerMargin) }}
          </span>
        </div>
      </div>

      <!-- Expected Value -->
      <div>
        <h4
          class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"
        >
          <UIcon name="i-heroicons-currency-dollar" class="w-4 h-4" aria-hidden="true" />
          Expected Value
        </h4>

        <div class="grid grid-cols-3 gap-3">
          <div
            v-for="outcome in ['home', 'draw', 'away'] as const"
            :key="outcome"
            class="p-3 rounded-lg text-center"
            :class="getEVBackgroundClass(calculations.expectedValues[outcome], outcome)"
          >
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {{ outcome === 'home' ? '1' : outcome === 'draw' ? 'X' : '2' }}
            </div>
            <div
              class="text-lg font-bold"
              :class="getEVTextClass(calculations.expectedValues[outcome])"
            >
              {{ formatEV(calculations.expectedValues[outcome]) }}
            </div>
            <UBadge
              v-if="
                calculations.bestValueOutcome ===
                (outcome === 'home' ? '1' : outcome === 'draw' ? 'X' : '2')
              "
              color="success"
              variant="soft"
              size="xs"
              class="mt-1"
            >
              VALUE
            </UBadge>
          </div>
        </div>
      </div>

      <!-- Form Metrics -->
      <div v-if="calculations.form.home.ema !== null || calculations.form.away.ema !== null">
        <h4
          class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"
        >
          <UIcon name="i-heroicons-fire" class="w-4 h-4" aria-hidden="true" />
          Form (EMA)
        </h4>

        <div class="space-y-3">
          <!-- Home Team Form -->
          <div v-if="calculations.form.home.ema !== null" class="flex items-center gap-3">
            <span
              class="text-sm text-gray-600 dark:text-gray-400 w-24 truncate"
              :title="homeTeamName"
            >
              {{ homeTeamName }}
            </span>
            <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                :class="getFormBarClass(calculations.form.home.ema)"
                :style="{ width: `${calculations.form.home.ema * 100}%` }"
              />
            </div>
            <span class="text-sm font-medium w-10 text-right">
              {{ calculations.form.home.ema.toFixed(2) }}
            </span>
            <UBadge
              v-if="calculations.form.home.regressionFlag"
              :color="
                calculations.form.home.regressionFlag === 'overperforming' ? 'warning' : 'info'
              "
              variant="soft"
              size="xs"
            >
              {{
                calculations.form.home.regressionFlag === 'overperforming'
                  ? 'Overperforming'
                  : 'Underperforming'
              }}
            </UBadge>
          </div>

          <!-- Away Team Form -->
          <div v-if="calculations.form.away.ema !== null" class="flex items-center gap-3">
            <span
              class="text-sm text-gray-600 dark:text-gray-400 w-24 truncate"
              :title="awayTeamName"
            >
              {{ awayTeamName }}
            </span>
            <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                :class="getFormBarClass(calculations.form.away.ema)"
                :style="{ width: `${calculations.form.away.ema * 100}%` }"
              />
            </div>
            <span class="text-sm font-medium w-10 text-right">
              {{ calculations.form.away.ema.toFixed(2) }}
            </span>
            <UBadge
              v-if="calculations.form.away.regressionFlag"
              :color="
                calculations.form.away.regressionFlag === 'overperforming' ? 'warning' : 'info'
              "
              variant="soft"
              size="xs"
            >
              {{
                calculations.form.away.regressionFlag === 'overperforming'
                  ? 'Overperforming'
                  : 'Underperforming'
              }}
            </UBadge>
          </div>
        </div>
      </div>

      <!-- Contextual Factors -->
      <div
        v-if="
          calculations.context.homeRestDays !== null || calculations.context.awayRestDays !== null
        "
      >
        <h4
          class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"
        >
          <UIcon name="i-heroicons-clock" class="w-4 h-4" aria-hidden="true" />
          Context
        </h4>

        <div class="flex flex-wrap gap-4 text-sm">
          <div v-if="calculations.context.homeRestDays !== null" class="flex items-center gap-2">
            <span class="text-gray-600 dark:text-gray-400">{{ homeTeamName }}:</span>
            <span class="font-medium">{{ calculations.context.homeRestDays }} days rest</span>
            <UBadge
              v-if="calculations.context.homeRestDays < 3"
              color="warning"
              variant="soft"
              size="xs"
            >
              Fatigue
            </UBadge>
          </div>
          <div v-if="calculations.context.awayRestDays !== null" class="flex items-center gap-2">
            <span class="text-gray-600 dark:text-gray-400">{{ awayTeamName }}:</span>
            <span class="font-medium">{{ calculations.context.awayRestDays }} days rest</span>
            <UBadge
              v-if="calculations.context.awayRestDays < 3"
              color="warning"
              variant="soft"
              size="xs"
            >
              Fatigue
            </UBadge>
          </div>
        </div>
      </div>

      <!-- Data Quality Indicator -->
      <div class="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2">
        <span>Data quality: {{ calculations.dataQuality }}</span>
        <span>•</span>
        <span>Model: {{ calculations.modelVersion }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
interface MatchCalculations {
  matchId: number
  modelProbabilities: {
    home: number
    draw: number
    away: number
  }
  expectedGoals: {
    home: number
    away: number
  }
  fairProbabilities: {
    home: number
    draw: number
    away: number
  }
  bookmakerMargin: number
  expectedValues: {
    home: number
    draw: number
    away: number
  }
  bestValueOutcome: '1' | 'X' | '2' | null
  form: {
    home: {
      ema: number | null
      xgTrend: number | null
      regressionFlag: 'overperforming' | 'underperforming' | null
    }
    away: {
      ema: number | null
      xgTrend: number | null
      regressionFlag: 'overperforming' | 'underperforming' | null
    }
  }
  context: {
    homeRestDays: number | null
    awayRestDays: number | null
    importanceScore: number | null
  }
  dataQuality: 'full' | 'partial' | 'minimal'
  modelVersion: string
  calculatedAt: string
}

interface MarketProbabilities {
  home: number
  draw: number
  away: number
}

const props = defineProps<{
  matchId: number
  homeTeamName: string
  awayTeamName: string
}>()

const loading = ref(true)
const error = ref<string | null>(null)
const calculations = ref<MatchCalculations | null>(null)
const marketProbabilities = ref<MarketProbabilities | null>(null)

// Fetch calculations when component mounts
onMounted(async () => {
  await fetchCalculations()
})

async function fetchCalculations() {
  loading.value = true
  error.value = null

  try {
    const response = await $fetch<{
      success: boolean
      data: MatchCalculations | null
      marketProbabilities: MarketProbabilities | null
      message?: string
    }>(`/api/matches/${props.matchId}/calculations`)

    if (response.success) {
      calculations.value = response.data
      marketProbabilities.value = response.marketProbabilities
    } else {
      error.value = response.message || 'Failed to load calculations'
    }
  } catch (err) {
    console.error('Error fetching calculations:', err)
    error.value = 'Failed to load model analysis'
  } finally {
    loading.value = false
  }
}

// Computed: probability differences
const probDiff = computed(() => {
  if (!calculations.value || !marketProbabilities.value) {
    return { home: null, draw: null, away: null }
  }
  return {
    home: calculations.value.modelProbabilities.home - marketProbabilities.value.home,
    draw: calculations.value.modelProbabilities.draw - marketProbabilities.value.draw,
    away: calculations.value.modelProbabilities.away - marketProbabilities.value.away,
  }
})

// Formatters
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatDiff(value: number | null): string {
  if (value === null) return '-'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(1)}%`
}

function formatEV(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(1)}%`
}

// Style helpers
function getDiffClass(diff: number | null): string {
  if (diff === null) return 'text-gray-400'
  if (diff > 0.03) return 'text-green-600 dark:text-green-400 font-semibold'
  if (diff < -0.03) return 'text-red-600 dark:text-red-400'
  return 'text-gray-600 dark:text-gray-400'
}

function getEVBackgroundClass(ev: number, outcome: 'home' | 'draw' | 'away'): string {
  const isBestValue =
    calculations.value?.bestValueOutcome ===
    (outcome === 'home' ? '1' : outcome === 'draw' ? 'X' : '2')

  if (isBestValue && ev > 0.03) {
    return 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
  }
  return 'bg-gray-50 dark:bg-gray-800'
}

function getEVTextClass(ev: number): string {
  if (ev > 0.05) return 'text-green-600 dark:text-green-400'
  if (ev > 0) return 'text-green-500 dark:text-green-500'
  if (ev < -0.1) return 'text-red-600 dark:text-red-400'
  return 'text-gray-600 dark:text-gray-400'
}

function getFormBarClass(ema: number): string {
  if (ema >= 0.7) return 'bg-green-500'
  if (ema >= 0.5) return 'bg-yellow-500'
  if (ema >= 0.3) return 'bg-orange-500'
  return 'bg-red-500'
}
</script>
