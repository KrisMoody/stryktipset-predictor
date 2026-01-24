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
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-4xl font-bold mb-2">AI Metrics Dashboard</h1>
            <p class="text-gray-600 dark:text-gray-400">
              Monitor AI usage, costs, and optimization opportunities
            </p>
          </div>
          <div class="flex gap-2">
            <UButton
              icon="i-heroicons-arrow-path"
              variant="outline"
              :loading="refreshing"
              @click="refreshData"
            >
              Refresh
            </UButton>
            <UButton
              icon="i-heroicons-arrow-down-tray"
              variant="outline"
              :loading="exporting"
              @click="exportData"
            >
              Export CSV
            </UButton>
          </div>
        </div>

        <!-- Date Range Selector -->
        <div class="flex gap-2">
          <UFieldGroup size="sm">
            <UButton
              v-for="preset in datePresets"
              :key="preset.value"
              :variant="selectedPreset === preset.value ? 'solid' : 'ghost'"
              @click="selectPreset(preset.value)"
            >
              {{ preset.label }}
            </UButton>
          </UFieldGroup>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="text-center">
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"
          />
          <p class="text-gray-600 dark:text-gray-400">Loading AI metrics...</p>
        </div>
      </div>

      <!-- Dashboard Content -->
      <div v-else class="space-y-6">
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <AiMetricsCostCard
            title="Total Cost"
            :value="overview?.totalCost || 0"
            format="currency"
            :decimals="2"
            icon="i-heroicons-currency-dollar"
            :subtitle="`${overview?.totalRequests || 0} total requests`"
          />
          <AiMetricsCostCard
            title="Total Tokens"
            :value="overview?.totalTokens || 0"
            format="number"
            icon="i-heroicons-cube"
            :subtitle="`${formatNumber(overview?.totalInputTokens || 0)} in / ${formatNumber(overview?.totalOutputTokens || 0)} out`"
          />
          <AiMetricsCostCard
            title="Success Rate"
            :value="overview?.successRate || 0"
            format="percentage"
            :decimals="1"
            icon="i-heroicons-check-circle"
            :color-class="getSuccessRateColor(overview?.successRate || 0)"
          />
          <AiMetricsCostCard
            title="Avg Cost/Request"
            :value="overview?.averageCostPerRequest || 0"
            format="currency"
            :decimals="6"
            icon="i-heroicons-calculator"
          />
        </div>

        <!-- Budget Analysis -->
        <UCard v-if="budget">
          <template #header>
            <h2 class="text-2xl font-semibold">Budget & Forecasting</h2>
          </template>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Current Month</p>
              <p class="text-3xl font-bold">${{ budget.currentMonthSpending.toFixed(2) }}</p>
              <p class="text-xs text-gray-500 mt-1">
                Daily avg: ${{ budget.dailyAverageSpending.toFixed(2) }}
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Projected Monthly</p>
              <p class="text-3xl font-bold">${{ budget.projectedMonthlySpending.toFixed(2) }}</p>
              <p class="text-xs" :class="getTrendClass(budget.trend)">
                {{ getTrendLabel(budget.trend) }}
                ({{ budget.percentageChange > 0 ? '+' : ''
                }}{{ budget.percentageChange.toFixed(1) }}%)
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Last Month</p>
              <p class="text-3xl font-bold">${{ budget.lastMonthSpending.toFixed(2) }}</p>
              <p class="text-xs text-gray-500 mt-1">
                {{ budget.remainingDaysInMonth }} days remaining
              </p>
            </div>
          </div>
        </UCard>

        <!-- Cost Trends Chart -->
        <ClientOnly>
          <AiMetricsCostChart
            title="Cost Trends"
            :chart-data="currentTrendData"
            :selected-period="chartPeriod"
            data-key="cost"
            @period-change="handlePeriodChange"
          />
          <template #fallback>
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-semibold">Cost Trends</h3>
                </div>
              </template>
              <div class="h-64 flex items-center justify-center">
                <div class="animate-pulse text-gray-400">Loading chart...</div>
              </div>
            </UCard>
          </template>
        </ClientOnly>

        <!-- Cost Breakdowns -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AiMetricsModelBreakdown
            title="Cost by AI Model"
            :data="costs?.byModel || null"
            :loading="loadingCosts"
          />
          <AiMetricsModelBreakdown
            title="Cost by Operation Type"
            :data="costs?.byOperation || null"
            :loading="loadingCosts"
          />
        </div>

        <!-- Token Efficiency -->
        <UCard v-if="efficiency">
          <template #header>
            <h2 class="text-2xl font-semibold">Token Efficiency</h2>
          </template>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Avg Tokens/Prediction</p>
              <p class="text-2xl font-bold">
                {{ formatNumber(efficiency.averageTokensPerPrediction) }}
              </p>
              <p class="text-xs text-gray-500">
                ${{ efficiency.costPerPrediction.toFixed(4) }} per prediction
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Avg Tokens/Scrape</p>
              <p class="text-2xl font-bold">
                {{ formatNumber(efficiency.averageTokensPerScrape) }}
              </p>
              <p class="text-xs text-gray-500">
                ${{ efficiency.costPerScrape.toFixed(4) }} per scrape
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Avg Tokens/Embedding</p>
              <p class="text-2xl font-bold">
                {{ formatNumber(efficiency.averageTokensPerEmbedding) }}
              </p>
              <p class="text-xs text-gray-500">
                ${{ efficiency.costPerEmbedding.toFixed(6) }} per embedding
              </p>
            </div>
          </div>

          <!-- Most Expensive Operations -->
          <div v-if="efficiency.mostExpensiveOperations.length > 0">
            <h3 class="text-lg font-semibold mb-4">Most Expensive Operations</h3>
            <div class="space-y-2">
              <div
                v-for="op in efficiency.mostExpensiveOperations.slice(0, 5)"
                :key="op.operationId"
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div>
                  <p class="font-medium">
                    {{ op.operationId }}
                  </p>
                  <p class="text-xs text-gray-500">{{ op.dataType }} • {{ op.model }}</p>
                </div>
                <div class="text-right">
                  <p class="font-semibold">${{ op.cost.toFixed(4) }}</p>
                  <p class="text-xs text-gray-500">{{ formatNumber(op.tokens) }} tokens</p>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Optimization Recommendations -->
        <div v-if="recommendations && recommendations.length > 0">
          <h2 class="text-2xl font-semibold mb-4">Optimization Recommendations</h2>
          <div class="grid grid-cols-1 gap-4">
            <AiMetricsOptimizationAlert
              v-for="rec in recommendations"
              :key="rec.id"
              :recommendation="rec"
            />
          </div>
        </div>
      </div>
    </template>
  </UContainer>
</template>

<script setup lang="ts">
import type {
  ModelCostBreakdown,
  OperationCostBreakdown,
  CostTrends,
  BudgetAnalysis,
  OptimizationRecommendation,
} from '~/types'
import { useUserProfile } from '~/composables/useUserProfile'

definePageMeta({})

// Admin access check
const { isAdmin, fetchProfile, loading: profileLoading } = useUserProfile()
const accessDenied = ref(false)

// Types for serialized API responses (Date fields become strings over HTTP)
interface AIMetricsOverviewResponse {
  totalCost: number
  totalTokens: number
  totalInputTokens: number
  totalOutputTokens: number
  totalRequests: number
  successRate: number
  averageCostPerRequest: number
  averageDuration: number
  dateRange: { start: string; end: string }
}

interface TokenEfficiencyMetricsResponse {
  averageTokensPerPrediction: number
  averageTokensPerScrape: number
  averageTokensPerEmbedding: number
  costPerPrediction: number
  costPerScrape: number
  costPerEmbedding: number
  mostExpensiveOperations: Array<{
    operationId: string
    dataType: string
    model: string
    cost: number
    tokens: number
    timestamp: string
  }>
}

interface AIMetricsExportData {
  operationId: string
  dataType: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  duration: number
  timestamp: string
  success: boolean
}

useHead({
  title: 'AI Metrics Dashboard - Stryktipset AI Predictor',
})

// State
const selectedPreset = ref<string>('30days')
const chartPeriod = ref<'daily' | 'weekly' | 'monthly'>('daily')
const loading = ref(true)
const refreshing = ref(false)
const exporting = ref(false)
const loadingCosts = ref(false)

// Data
const overview = ref<AIMetricsOverviewResponse | null>(null)
const costs = ref<{ byModel: ModelCostBreakdown[]; byOperation: OperationCostBreakdown[] } | null>(
  null
)
const trends = ref<CostTrends | null>(null)
const efficiency = ref<TokenEfficiencyMetricsResponse | null>(null)
const budget = ref<BudgetAnalysis | null>(null)
const recommendations = ref<OptimizationRecommendation[]>([])

const datePresets = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7days' },
  { label: 'Last 30 Days', value: '30days' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'All Time', value: 'all' },
]

const currentTrendData = computed(() => {
  if (!trends.value) return null

  switch (chartPeriod.value) {
    case 'weekly':
      return trends.value.weekly
    case 'monthly':
      return trends.value.monthly
    case 'daily':
    default:
      return trends.value.daily
  }
})

// Load data on mount
onMounted(async () => {
  // Check admin access first
  await fetchProfile()
  if (!isAdmin.value) {
    accessDenied.value = true
    return
  }

  await loadAllData()
})

async function loadAllData() {
  loading.value = true
  try {
    const queryParams = `?preset=${selectedPreset.value}`

    const [overviewRes, costsRes, trendsRes, efficiencyRes, budgetRes, recsRes] = await Promise.all(
      [
        $fetch(`/api/admin/ai-metrics/overview${queryParams}`),
        $fetch(`/api/admin/ai-metrics/costs${queryParams}`),
        $fetch(`/api/admin/ai-metrics/trends${queryParams}`),
        $fetch(`/api/admin/ai-metrics/efficiency${queryParams}`),
        $fetch('/api/admin/ai-metrics/budget'),
        $fetch(`/api/admin/ai-metrics/recommendations${queryParams}`),
      ]
    )

    if ('success' in overviewRes && overviewRes.success && 'data' in overviewRes)
      overview.value = overviewRes.data
    if ('success' in costsRes && costsRes.success && 'data' in costsRes) costs.value = costsRes.data
    if ('success' in trendsRes && trendsRes.success && 'data' in trendsRes)
      trends.value = trendsRes.data
    if ('success' in efficiencyRes && efficiencyRes.success && 'data' in efficiencyRes)
      efficiency.value = efficiencyRes.data
    if ('success' in budgetRes && budgetRes.success && 'data' in budgetRes)
      budget.value = budgetRes.data
    if ('success' in recsRes && recsRes.success && 'data' in recsRes)
      recommendations.value = recsRes.data
  } catch (error) {
    console.error('Error loading AI metrics:', error)
  } finally {
    loading.value = false
  }
}

async function refreshData() {
  refreshing.value = true
  await loadAllData()
  refreshing.value = false
}

async function selectPreset(preset: string) {
  selectedPreset.value = preset
  await loadAllData()
}

function handlePeriodChange(period: 'daily' | 'weekly' | 'monthly') {
  chartPeriod.value = period
}

async function exportData() {
  exporting.value = true
  try {
    // Fetch raw data for export
    const response = await $fetch(`/api/admin/ai-metrics/export?preset=${selectedPreset.value}`)

    if ('success' in response && response.success && 'data' in response && response.data) {
      // Convert to CSV
      const csv = convertToCSV(response.data as AIMetricsExportData[])

      // Download file
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ai-metrics-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error('Error exporting data:', error)
  } finally {
    exporting.value = false
  }
}

function convertToCSV(data: AIMetricsExportData[]): string {
  if (!data || data.length === 0) return ''

  const firstRow = data[0]
  if (!firstRow) return ''

  const headers = Object.keys(firstRow) as (keyof AIMetricsExportData)[]
  const rows = data.map(row => headers.map(header => JSON.stringify(row[header] ?? '')).join(','))

  return [headers.join(','), ...rows].join('\n')
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toLocaleString()
}

function getSuccessRateColor(rate: number): string {
  if (rate >= 95) return 'text-green-700 dark:text-green-400'
  if (rate >= 85) return 'text-yellow-700 dark:text-yellow-400'
  return 'text-red-700 dark:text-red-400'
}

function getTrendClass(trend: string): string {
  switch (trend) {
    case 'increasing':
      return 'text-red-700 dark:text-red-400'
    case 'decreasing':
      return 'text-green-700 dark:text-green-400'
    default:
      return 'text-gray-500'
  }
}

function getTrendLabel(trend: string): string {
  switch (trend) {
    case 'increasing':
      return '↑ Increasing'
    case 'decreasing':
      return '↓ Decreasing'
    default:
      return '→ Stable'
  }
}
</script>
