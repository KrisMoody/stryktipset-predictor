<template>
  <div v-if="hasOdds" class="space-y-3">
    <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">Market Odds</div>

    <div class="grid grid-cols-3 gap-2">
      <div
        v-for="outcome in ['1', 'X', '2']"
        :key="outcome"
        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
      >
        <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">
          {{ outcome }}
        </div>

        <!-- Current Odds -->
        <div v-if="currentOdds" class="font-semibold text-lg">
          {{ getOdds(currentOdds, outcome) }}
        </div>

        <!-- Start Odds & Movement -->
        <div v-if="startOdds && currentOdds" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span class="text-gray-500 dark:text-gray-400">{{ getOdds(startOdds, outcome) }}</span>
          <span v-if="hasMovement(outcome)" :class="getMovementClass(outcome)" class="ml-1">
            {{ getMovement(outcome) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Expert Tips -->
    <div
      v-if="hasExpertTips && currentOdds"
      class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
    >
      <div class="text-xs text-gray-600 dark:text-gray-400 mb-2">10 Tidningars Tips</div>
      <div class="flex gap-3 text-xs">
        <span v-if="currentOdds.tio_tidningars_tips_home"
          >1: {{ currentOdds.tio_tidningars_tips_home }}</span
        >
        <span v-if="currentOdds.tio_tidningars_tips_draw"
          >X: {{ currentOdds.tio_tidningars_tips_draw }}</span
        >
        <span v-if="currentOdds.tio_tidningars_tips_away"
          >2: {{ currentOdds.tio_tidningars_tips_away }}</span
        >
      </div>
    </div>
  </div>

  <div v-else class="text-sm text-gray-500 dark:text-gray-400">No odds available yet</div>
</template>

<script setup lang="ts">
interface Odds {
  type?: 'current' | 'start' | string
  home_odds: string | number
  draw_odds: string | number
  away_odds: string | number
  tio_tidningars_tips_home?: string | null
  tio_tidningars_tips_draw?: string | null
  tio_tidningars_tips_away?: string | null
}

interface Props {
  matchOdds?: Array<Odds>
}

const props = defineProps<Props>()

const currentOdds = computed(() => {
  return props.matchOdds?.find(o => o.type === 'current')
})

const startOdds = computed(() => {
  return props.matchOdds?.find(o => o.type === 'start')
})

const hasOdds = computed(() => {
  return !!currentOdds.value
})

const hasExpertTips = computed(() => {
  return (
    currentOdds.value?.tio_tidningars_tips_home ||
    currentOdds.value?.tio_tidningars_tips_draw ||
    currentOdds.value?.tio_tidningars_tips_away
  )
})

const getOdds = (odds: Odds, outcome: string) => {
  const value = outcome === '1' ? odds.home_odds : outcome === 'X' ? odds.draw_odds : odds.away_odds
  return typeof value === 'string' ? value : value.toFixed(2)
}

const hasMovement = (outcome: string) => {
  if (!startOdds.value || !currentOdds.value) return false
  const start = parseFloat(getOdds(startOdds.value, outcome))
  const current = parseFloat(getOdds(currentOdds.value, outcome))
  return Math.abs(start - current) > 0.01
}

const getMovement = (outcome: string) => {
  if (!startOdds.value || !currentOdds.value) return ''
  const start = parseFloat(getOdds(startOdds.value, outcome))
  const current = parseFloat(getOdds(currentOdds.value, outcome))
  const diff = current - start
  if (Math.abs(diff) < 0.01) return ''
  return diff > 0 ? `↑ ${diff.toFixed(2)}` : `↓ ${Math.abs(diff).toFixed(2)}`
}

const getMovementClass = (outcome: string) => {
  if (!startOdds.value || !currentOdds.value) return ''
  const start = parseFloat(getOdds(startOdds.value, outcome))
  const current = parseFloat(getOdds(currentOdds.value, outcome))
  const diff = current - start
  return diff > 0 ? 'text-red-500' : 'text-green-500'
}
</script>
