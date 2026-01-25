<template>
  <UContainer class="py-8">
    <div class="mb-8">
      <div class="flex items-center gap-4 mb-2">
        <UButton variant="ghost" to="/performance" size="sm">
          <UIcon name="i-heroicons-arrow-left" class="w-4 h-4 mr-1" />
          Back to Performance
        </UButton>
      </div>
      <h1 class="text-4xl font-bold mb-2">Draw #{{ drawNumber }} Results</h1>
      <p class="text-gray-600 dark:text-gray-400">
        View the winning combination and your system results
      </p>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
    </div>

    <div v-else-if="error" class="text-center py-12">
      <div class="text-6xl mb-4">😕</div>
      <h3 class="text-xl font-semibold mb-2">Failed to load results</h3>
      <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error.message }}</p>
      <UButton to="/performance" variant="outline">Back to Performance</UButton>
    </div>

    <OptimizeCompletedDrawResults
      v-else-if="data"
      :draw-number="drawNumber"
      :is-complete="data.isComplete"
      :correct-row="data.correctRow ?? ''"
      :match-details="matchDetails"
      :coupons="coupons"
    />
  </UContainer>
</template>

<script setup lang="ts">
import type { CouponRow } from '~/types'

const route = useRoute()
const drawNumber = computed(() => parseInt(route.params.id as string) || 0)

interface Match {
  matchNumber: number
  homeTeam: string
  awayTeam: string
  outcome: string | null
  homeScore: number | null
  awayScore: number | null
}

interface SystemResult {
  systemId: string
  systemType: string
  correctRow: string | null
  bestScore: number | null
  winningRows: number | null
  scoreDistribution: Record<number, number> | null
  payout: number
  roi: number
  cost: number
  rows: Array<{ picks: string[] } | string[]>
  analyzedAt: Date | null
}

interface DrawResultsResponse {
  success: boolean
  drawNumber: number
  correctRow: string | null
  isComplete: boolean
  matches: Match[]
  systemResults: SystemResult[]
}

const { data, pending, error } = await useFetch<DrawResultsResponse>(
  () => `/api/draws/${drawNumber.value}/results`
)

// Transform matches to matchDetails format
const matchDetails = computed(() => {
  if (!data.value?.matches) return []
  return data.value.matches.map(m => ({
    matchNumber: m.matchNumber,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    result: m.homeScore !== null && m.awayScore !== null ? `${m.homeScore}-${m.awayScore}` : null,
    outcome: m.outcome,
  }))
})

// Transform systemResults to coupons format
const coupons = computed(() => {
  if (!data.value?.systemResults) return []
  return data.value.systemResults.map(sr => ({
    systemId: sr.systemId,
    systemType: sr.systemType,
    rows: sr.rows.map(row => {
      // Handle both formats: { picks: string[] } or string[]
      const picks = Array.isArray(row) ? row : row.picks
      return { picks } as CouponRow
    }),
    bestScore: sr.bestScore ?? 0,
    winningRows: sr.winningRows ?? 0,
    scoreDistribution: sr.scoreDistribution ?? {},
    payout: sr.payout,
    roi: sr.roi,
  }))
})

useHead({
  title: computed(() => `Draw #${drawNumber.value} Results - Stryktipset AI Predictor`),
})
</script>
