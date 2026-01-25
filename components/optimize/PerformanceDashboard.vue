<template>
  <div class="space-y-6">
    <!-- Overall Stats -->
    <UCard>
      <template #header>
        <h3 class="text-xl font-semibold">Performance Overview</h3>
      </template>

      <div v-if="pending" class="flex justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>

      <div v-else-if="stats" class="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Draws Analyzed</div>
          <div class="text-2xl font-bold">
            {{ stats.totalDrawsAnalyzed }}
          </div>
        </div>
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Total Cost</div>
          <div class="text-2xl font-bold">{{ stats.totalCost }} SEK</div>
        </div>
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Total Payout</div>
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">
            {{ formatNumber(stats.totalPayout) }} SEK
          </div>
        </div>
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Overall ROI</div>
          <div
            class="text-2xl font-bold"
            :class="
              stats.overallRoi >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            "
          >
            {{ stats.overallRoi.toFixed(1) }}%
          </div>
        </div>
      </div>

      <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
        No performance data available yet. Generate coupons and analyze completed draws to see
        stats.
      </div>
    </UCard>

    <!-- System Type Comparison -->
    <UCard v-if="stats && stats.totalDrawsAnalyzed > 0">
      <template #header>
        <h3 class="text-xl font-semibold">R vs U System Comparison</h3>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <div class="flex items-center gap-2 mb-4">
            <UBadge color="info" variant="solid" size="lg"> R-Systems </UBadge>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Coupons:</span>
              <span class="font-semibold">{{ stats.systemTypeComparison.R.count }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Avg Score:</span>
              <span class="font-semibold">{{
                stats.systemTypeComparison.R.avgScore.toFixed(1)
              }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">ROI:</span>
              <span
                class="font-semibold"
                :class="stats.systemTypeComparison.R.roi >= 0 ? 'text-green-600' : 'text-red-600'"
              >
                {{ stats.systemTypeComparison.R.roi.toFixed(1) }}%
              </span>
            </div>
          </div>
        </div>

        <div class="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
          <div class="flex items-center gap-2 mb-4">
            <UBadge color="secondary" variant="solid" size="lg"> U-Systems </UBadge>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Coupons:</span>
              <span class="font-semibold">{{ stats.systemTypeComparison.U.count }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Avg Score:</span>
              <span class="font-semibold">{{
                stats.systemTypeComparison.U.avgScore.toFixed(1)
              }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">ROI:</span>
              <span
                class="font-semibold"
                :class="stats.systemTypeComparison.U.roi >= 0 ? 'text-green-600' : 'text-red-600'"
              >
                {{ stats.systemTypeComparison.U.roi.toFixed(1) }}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Leaderboard -->
    <UCard v-if="leaderboard && leaderboard.length > 0">
      <template #header>
        <h3 class="text-xl font-semibold">System Leaderboard</h3>
      </template>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th class="px-4 py-3 text-left font-semibold">Rank</th>
              <th class="px-4 py-3 text-left font-semibold">System</th>
              <th class="px-4 py-3 text-left font-semibold">Type</th>
              <th class="px-4 py-3 text-right font-semibold">Draws</th>
              <th class="px-4 py-3 text-right font-semibold">Avg Score</th>
              <th class="px-4 py-3 text-right font-semibold">ROI</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(system, idx) in leaderboard"
              :key="system.systemId"
              :class="idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'"
            >
              <td class="px-4 py-3">
                <span
                  v-if="idx < 3"
                  class="inline-flex items-center justify-center w-6 h-6 rounded-full"
                  :class="[
                    idx === 0 ? 'bg-yellow-500 text-white' : '',
                    idx === 1 ? 'bg-gray-400 text-white' : '',
                    idx === 2 ? 'bg-amber-600 text-white' : '',
                  ]"
                >
                  {{ idx + 1 }}
                </span>
                <span v-else class="text-gray-500">{{ idx + 1 }}</span>
              </td>
              <td class="px-4 py-3 font-medium">
                {{ system.systemId }}
              </td>
              <td class="px-4 py-3">
                <UBadge
                  :color="system.systemType === 'R' ? 'info' : 'secondary'"
                  variant="soft"
                  size="sm"
                >
                  {{ system.systemType }}
                </UBadge>
              </td>
              <td class="px-4 py-3 text-right">
                {{ system.drawsPlayed }}
              </td>
              <td class="px-4 py-3 text-right">
                {{ system.avgBestScore.toFixed(1) }}
              </td>
              <td
                class="px-4 py-3 text-right font-semibold"
                :class="
                  system.roi >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                "
              >
                {{ system.roi.toFixed(1) }}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Recent Results -->
    <UCard v-if="recentDraws && recentDraws.length > 0">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold">Recent Results</h3>
          <USelect
            v-model="systemTypeFilter"
            :items="systemTypeOptions"
            size="sm"
            class="w-32"
          />
        </div>
      </template>

      <div class="space-y-4">
        <div
          v-for="draw in recentDraws"
          :key="draw.drawNumber"
          class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        >
          <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
            <div class="flex items-center gap-3">
              <div class="font-semibold">Draw #{{ draw.drawNumber }}</div>
              <div v-if="draw.correctRow" class="flex gap-0.5">
                <span
                  v-for="(sign, idx) in draw.correctRow.split('')"
                  :key="idx"
                  class="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-mono"
                  :class="getOutcomeClass(sign)"
                >
                  {{ sign }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <div class="text-right">
                <div class="text-xs text-gray-500 dark:text-gray-400">Best</div>
                <div class="font-bold" :class="getScoreColor(draw.bestScore)">
                  {{ draw.bestScore }}/13
                </div>
              </div>
              <div class="text-right">
                <div class="text-xs text-gray-500 dark:text-gray-400">Payout</div>
                <div class="font-bold text-green-600 dark:text-green-400">
                  {{ formatNumber(draw.totalPayout) }}
                </div>
              </div>
              <div class="text-right">
                <div class="text-xs text-gray-500 dark:text-gray-400">ROI</div>
                <div
                  class="font-bold"
                  :class="draw.overallRoi >= 0 ? 'text-green-600' : 'text-red-600'"
                >
                  {{ draw.overallRoi.toFixed(0) }}%
                </div>
              </div>
              <UButton
                variant="ghost"
                size="sm"
                icon="i-heroicons-eye"
                @click="showDrawDetails(draw.drawNumber)"
              />
            </div>
          </div>
          <div class="p-3">
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="sys in draw.systems"
                :key="sys.systemId"
                :color="sys.systemType === 'R' ? 'info' : 'secondary'"
                variant="soft"
                size="sm"
              >
                {{ sys.systemId }}: {{ sys.bestScore }}/13
              </UBadge>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Fallback: Recent Trend (if no recent draws data) -->
    <UCard v-else-if="recentTrend && recentTrend.length > 0">
      <template #header>
        <h3 class="text-xl font-semibold">Recent Performance</h3>
      </template>

      <div class="space-y-3">
        <div
          v-for="perf in recentTrend"
          :key="`${perf.drawNumber}-${perf.systemId}`"
          class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
        >
          <div>
            <div class="font-semibold">Draw #{{ perf.drawNumber }}</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ perf.systemId }}
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="text-sm text-gray-500 dark:text-gray-400">Best Score</div>
              <div class="font-bold text-lg" :class="getScoreColor(perf.bestScore)">
                {{ perf.bestScore }}/13
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm text-gray-500 dark:text-gray-400">ROI</div>
              <div
                class="font-bold"
                :class="
                  perf.roi >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                "
              >
                {{ perf.roi.toFixed(0) }}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Draw Details Modal -->
    <UModal v-model:open="showDrawModal">
      <template #content>
        <div v-if="selectedDrawData" class="p-6 max-w-4xl">
          <OptimizeCompletedDrawResults
            :draw-number="selectedDrawData.drawNumber"
            :draw-date="selectedDrawData.drawDate"
            :is-complete="selectedDrawData.isComplete"
            :correct-row="selectedDrawData.correctRow"
            :match-details="selectedDrawData.matchDetails"
            :coupons="selectedDrawData.coupons"
          />
        </div>
        <div v-else class="flex justify-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </template>
    </UModal>

    <!-- Empty State -->
    <UCard v-if="!pending && (!stats || stats.totalDrawsAnalyzed === 0)">
      <div class="text-center py-12">
        <div class="text-6xl mb-4">📊</div>
        <h3 class="text-xl font-semibold mb-2">No Performance Data Yet</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Generate coupons using R or U-systems and wait for draws to complete. Then analyze them to
          see performance statistics.
        </p>
        <UButton to="/draws" variant="outline"> View Draws </UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
interface OverallStats {
  totalDrawsAnalyzed: number
  totalCost: number
  totalPayout: number
  overallRoi: number
  bestPerformingSystem: string | null
  worstPerformingSystem: string | null
  avgBestScore: number
  systemTypeComparison: {
    R: { count: number; roi: number; avgScore: number }
    U: { count: number; roi: number; avgScore: number }
  }
}

interface LeaderboardEntry {
  systemId: string
  systemType: 'R' | 'U'
  drawsPlayed: number
  roi: number
  avgBestScore: number
}

interface TrendEntry {
  drawNumber: number
  systemId: string
  bestScore: number
  roi: number
  createdAt: Date
}

// Fetch performance data
const { data, pending } = await useFetch<{
  success: boolean
  stats: OverallStats
  leaderboard: LeaderboardEntry[]
  recentTrend: TrendEntry[]
}>('/api/system-performance/summary')

const stats = computed(() => data.value?.stats)
const leaderboard = computed(() => data.value?.leaderboard || [])
const recentTrend = computed(() => data.value?.recentTrend || [])

// Recent draws filter
const systemTypeFilter = ref('All')
const systemTypeOptions = ['All', 'R', 'U']

interface RecentDraw {
  drawNumber: number
  correctRow: string | null
  systems: Array<{
    systemId: string
    systemType: string
    bestScore: number
    payout: number
  }>
  bestScore: number
  totalPayout: number
  overallRoi: number
}

const { data: recentDrawsData, refresh: refreshRecentDraws } = await useFetch<{
  success: boolean
  draws: RecentDraw[]
}>('/api/system-performance/recent-draws', {
  query: computed(() => ({
    limit: 5,
    systemType: systemTypeFilter.value === 'All' ? undefined : systemTypeFilter.value,
  })),
})

const recentDraws = computed(() => recentDrawsData.value?.draws || [])

watch(systemTypeFilter, () => {
  refreshRecentDraws()
})

// Draw details modal
const showDrawModal = ref(false)
const selectedDrawData = ref<{
  drawNumber: number
  drawDate?: string
  isComplete: boolean
  correctRow: string
  matchDetails: Array<{
    matchNumber: number
    homeTeam: string
    awayTeam: string
    result: string | null
    outcome: string | null
  }>
  coupons: Array<{
    systemId: string
    systemType: string
    rows: Array<{ rowNumber: number; picks: string[] }>
    bestScore: number
    winningRows: number
    scoreDistribution: Record<number, number>
    payout: number
    roi: number
  }>
} | null>(null)

interface DrawDetailsResponse {
  success: boolean
  drawNumber: number
  drawDate?: string
  isComplete: boolean
  correctRow: string
  matchDetails: Array<{
    matchNumber: number
    homeTeam: string
    awayTeam: string
    result: string | null
    outcome: string | null
  }>
  coupons: Array<{
    systemId: string
    systemType: string
    rows: Array<{ rowNumber: number; picks: string[] }>
    bestScore: number
    winningRows: number
    scoreDistribution: Record<number, number>
    payout: number
    roi: number
  }>
}

const showDrawDetails = async (drawNumber: number) => {
  showDrawModal.value = true
  selectedDrawData.value = null

  try {
    const response = await $fetch<DrawDetailsResponse>(
      `/api/system-performance/draw/${drawNumber}`
    )
    if (response?.success) {
      selectedDrawData.value = response
    }
  } catch (error) {
    console.error('Failed to fetch draw details:', error)
  }
}

const getOutcomeClass = (sign: string) => {
  switch (sign) {
    case '1':
      return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
    case 'X':
      return 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
    case '2':
      return 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-400'
  }
}

// Utility functions
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toFixed(0)
}

const getScoreColor = (score: number): string => {
  if (score === 13) return 'text-yellow-500'
  if (score >= 12) return 'text-green-600 dark:text-green-400'
  if (score >= 11) return 'text-blue-600 dark:text-blue-400'
  if (score >= 10) return 'text-primary-600 dark:text-primary-400'
  return 'text-gray-600 dark:text-gray-400'
}
</script>
