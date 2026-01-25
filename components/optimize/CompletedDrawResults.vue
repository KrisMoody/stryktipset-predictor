<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-xl font-semibold">Draw #{{ drawNumber }} Results</h3>
        <p v-if="drawDate" class="text-sm text-gray-500 dark:text-gray-400">
          {{ formatDate(drawDate) }}
        </p>
      </div>
      <UBadge
        :color="isComplete ? 'success' : 'warning'"
        variant="soft"
        size="lg"
      >
        {{ isComplete ? 'Completed' : 'In Progress' }}
      </UBadge>
    </div>

    <!-- Correct Row Display -->
    <UCard v-if="isComplete">
      <template #header>
        <h4 class="text-lg font-semibold flex items-center gap-2">
          <UIcon name="i-heroicons-trophy" class="w-5 h-5 text-yellow-500" />
          Winning Row
        </h4>
      </template>

      <div class="space-y-4">
        <!-- Match Results Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-2 py-2 text-left font-semibold w-8">#</th>
                <th class="px-2 py-2 text-left font-semibold">Match</th>
                <th class="px-2 py-2 text-center font-semibold w-16">Result</th>
                <th class="px-2 py-2 text-center font-semibold w-12">Sign</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="match in matchDetails"
                :key="match.matchNumber"
                class="border-b border-gray-100 dark:border-gray-700"
              >
                <td class="px-2 py-2 text-gray-500">{{ match.matchNumber }}</td>
                <td class="px-2 py-2">
                  <span class="font-medium">{{ match.homeTeam }}</span>
                  <span class="text-gray-400 mx-1">-</span>
                  <span>{{ match.awayTeam }}</span>
                </td>
                <td class="px-2 py-2 text-center font-mono">
                  {{ match.result || '-' }}
                </td>
                <td class="px-2 py-2 text-center">
                  <span
                    class="inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-lg"
                    :class="getOutcomeClass(match.outcome)"
                  >
                    {{ match.outcome || '?' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Correct Row String -->
        <div class="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Correct Row:</span>
          <span class="font-mono font-bold text-lg tracking-wider">{{ correctRow }}</span>
        </div>
      </div>
    </UCard>

    <!-- Generated Coupons Comparison -->
    <UCard v-if="coupons.length > 0">
      <template #header>
        <h4 class="text-lg font-semibold">Your Generated Coupons</h4>
      </template>

      <div class="space-y-6">
        <div
          v-for="coupon in coupons"
          :key="coupon.systemId"
          class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        >
          <!-- Coupon Header -->
          <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
            <div class="flex items-center gap-2">
              <UBadge
                :color="coupon.systemType === 'R' ? 'info' : 'secondary'"
                variant="solid"
              >
                {{ coupon.systemId }}
              </UBadge>
              <span class="text-sm text-gray-500 dark:text-gray-400">
                {{ coupon.rows.length }} rows
              </span>
            </div>
            <div class="flex items-center gap-4">
              <div class="text-right">
                <div class="text-xs text-gray-500 dark:text-gray-400">Best Score</div>
                <div class="font-bold" :class="getScoreColor(coupon.bestScore)">
                  {{ coupon.bestScore }}/13
                </div>
              </div>
              <div class="text-right">
                <div class="text-xs text-gray-500 dark:text-gray-400">ROI</div>
                <div
                  class="font-bold"
                  :class="coupon.roi >= 0 ? 'text-green-600' : 'text-red-600'"
                >
                  {{ coupon.roi.toFixed(0) }}%
                </div>
              </div>
            </div>
          </div>

          <!-- Rows Display (collapsible) -->
          <div class="p-3">
            <UButton
              variant="ghost"
              size="sm"
              :icon="expandedCoupons.includes(coupon.systemId) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
              @click="toggleCouponExpand(coupon.systemId)"
            >
              {{ expandedCoupons.includes(coupon.systemId) ? 'Hide' : 'Show' }} {{ coupon.rows.length }} rows
            </UButton>

            <div v-if="expandedCoupons.includes(coupon.systemId)" class="mt-3 space-y-1">
              <div
                v-for="(row, idx) in coupon.rows"
                :key="idx"
                class="flex items-center gap-2 p-2 rounded"
                :class="getRowScore(row, correctRow) === 13 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-50 dark:bg-gray-800'"
              >
                <span class="text-xs text-gray-400 w-6">{{ idx + 1 }}</span>
                <div class="flex gap-0.5">
                  <span
                    v-for="(pick, pickIdx) in row.picks"
                    :key="pickIdx"
                    class="inline-flex items-center justify-center w-6 h-6 rounded text-sm font-mono"
                    :class="getPickClass(pick, correctRow[pickIdx] || '')"
                  >
                    {{ pick }}
                  </span>
                </div>
                <span class="ml-2 text-sm font-semibold" :class="getScoreColor(getRowScore(row, correctRow))">
                  {{ getRowScore(row, correctRow) }}/13
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- No Coupons -->
    <UCard v-else-if="isComplete">
      <div class="text-center py-8 text-gray-500 dark:text-gray-400">
        <UIcon name="i-heroicons-document-text" class="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No generated coupons found for this draw</p>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { CouponRow } from '~/types'

interface MatchDetail {
  matchNumber: number
  homeTeam: string
  awayTeam: string
  result: string | null
  outcome: string | null
}

interface CouponResult {
  systemId: string
  systemType: string
  rows: CouponRow[]
  bestScore: number
  winningRows: number
  scoreDistribution: Record<number, number>
  payout: number
  roi: number
}

defineProps<{
  drawNumber: number
  drawDate?: string | Date
  isComplete: boolean
  correctRow: string
  matchDetails: MatchDetail[]
  coupons: CouponResult[]
}>()

const expandedCoupons = ref<string[]>([])

const toggleCouponExpand = (systemId: string) => {
  const idx = expandedCoupons.value.indexOf(systemId)
  if (idx >= 0) {
    expandedCoupons.value.splice(idx, 1)
  } else {
    expandedCoupons.value.push(systemId)
  }
}

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString('sv-SE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const getOutcomeClass = (outcome: string | null) => {
  switch (outcome) {
    case '1':
      return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
    case 'X':
      return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
    case '2':
      return 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-400'
  }
}

const getPickClass = (pick: string, correct: string) => {
  if (pick === correct) {
    return 'bg-green-500 text-white'
  }
  return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
}

const getRowScore = (row: CouponRow, correctRow: string): number => {
  let score = 0
  for (let i = 0; i < row.picks.length && i < correctRow.length; i++) {
    if (row.picks[i] === correctRow[i]) {
      score++
    }
  }
  return score
}

const getScoreColor = (score: number): string => {
  if (score === 13) return 'text-yellow-500'
  if (score >= 12) return 'text-green-600 dark:text-green-400'
  if (score >= 11) return 'text-blue-600 dark:text-blue-400'
  if (score >= 10) return 'text-primary-600 dark:text-primary-400'
  return 'text-gray-600 dark:text-gray-400'
}
</script>
