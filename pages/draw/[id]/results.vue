<template>
  <div class="p-6">
    <!-- Breadcrumb -->
    <AppBreadcrumb />

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            Draw #{{ drawNumber }} Results
          </h1>
          <UBadge color="neutral" variant="subtle" size="lg"> Completed </UBadge>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ gameDisplayName }}
        </p>
      </div>
      <UButton to="/admin" variant="ghost" color="neutral">
        <UIcon name="i-heroicons-arrow-left" class="w-4 h-4 mr-1" />
        Back to Admin
      </UButton>
    </div>

    <!-- Loading State -->
    <div v-if="pending" class="flex justify-center py-12">
      <div class="text-center">
        <div
          class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto mb-3"
        />
        <p class="text-gray-500 dark:text-gray-400">Loading results...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="py-12">
      <UAlert
        color="error"
        icon="i-heroicons-exclamation-triangle"
        title="Results Not Found"
        :description="
          error.message ||
          'Unable to load draw results. Please check the draw number and try again.'
        "
      />
      <div class="mt-4 flex gap-2">
        <UButton to="/admin" variant="soft" color="neutral"> Back to Admin </UButton>
        <UButton variant="soft" color="primary" @click="refresh()"> Retry </UButton>
      </div>
    </div>

    <!-- Results Content -->
    <OptimizeCompletedDrawResults
      v-else-if="data"
      :draw-number="drawNumber"
      :is-complete="data.isComplete"
      :correct-row="data.correctRow ?? ''"
      :match-details="matchDetails"
      :coupons="coupons"
    />
  </div>
</template>

<script setup lang="ts">
import type { CouponRow } from '~/types'
import type { GameType } from '~/types/game-types'
import { getGameConfig } from '~/server/constants/game-configs'

definePageMeta({})

const route = useRoute()
const drawNumber = computed(() => parseInt(route.params.id as string) || 0)

const gameType = computed(() => (route.query.gameType as GameType) || 'stryktipset')
const gameDisplayName = computed(() => getGameConfig(gameType.value).displayName)

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

const { data, pending, error, refresh } = await useFetch<DrawResultsResponse>(
  `/api/draws/${drawNumber.value}/results`,
  {
    query: { gameType },
    watch: [gameType],
  }
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
  title: computed(() => `Draw #${drawNumber.value} Results - ${gameDisplayName.value}`),
})
</script>
