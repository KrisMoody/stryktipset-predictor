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

    <!-- Recent Trend -->
    <UCard v-if="recentTrend && recentTrend.length > 0">
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
