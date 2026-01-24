<template>
  <div class="grid grid-cols-3 gap-2">
    <div
      v-for="outcome in outcomes"
      :key="outcome.label"
      class="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800 transition-colors"
      :class="flashClass(outcome.label)"
    >
      <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
        {{ outcome.label }}
      </div>
      <div class="text-lg font-bold text-gray-900 dark:text-white">
        {{ formatOdds(outcome.odds) }}
      </div>
      <div v-if="outcome.movement !== 0" class="flex items-center justify-center gap-1 mt-1">
        <UIcon
          :name="outcome.movement > 0 ? 'i-heroicons-arrow-up' : 'i-heroicons-arrow-down'"
          class="w-3 h-3"
          :class="outcome.movement > 0 ? 'text-red-500' : 'text-green-500'"
        />
        <span class="text-xs" :class="outcome.movement > 0 ? 'text-red-500' : 'text-green-500'">
          {{ Math.abs(outcome.movement).toFixed(2) }}
        </span>
      </div>
      <div v-else class="text-xs text-gray-400 mt-1">—</div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface OddsData {
  home_odds: string | number
  draw_odds: string | number
  away_odds: string | number
  home_movement?: number
  draw_movement?: number
  away_movement?: number
}

const props = defineProps<{
  odds: OddsData | null
}>()

const outcomes = computed(() => {
  if (!props.odds) {
    return [
      { label: '1', odds: null, movement: 0 },
      { label: 'X', odds: null, movement: 0 },
      { label: '2', odds: null, movement: 0 },
    ]
  }

  return [
    {
      label: '1',
      odds: props.odds.home_odds,
      movement: props.odds.home_movement || 0,
    },
    {
      label: 'X',
      odds: props.odds.draw_odds,
      movement: props.odds.draw_movement || 0,
    },
    {
      label: '2',
      odds: props.odds.away_odds,
      movement: props.odds.away_movement || 0,
    },
  ]
})

// Track recent changes for flash animation
const recentChanges = ref<Record<string, 'up' | 'down' | null>>({})

function flashClass(label: string): string {
  const change = recentChanges.value[label]
  if (change === 'up') return 'odds-flash-up'
  if (change === 'down') return 'odds-flash-down'
  return ''
}

function formatOdds(odds: string | number | null): string {
  if (odds === null || odds === undefined) return '—'
  const num = typeof odds === 'string' ? parseFloat(odds) : odds
  return num.toFixed(2)
}

// Watch for odds changes and trigger flash animation
watch(
  () => props.odds,
  (newOdds, oldOdds) => {
    if (!newOdds || !oldOdds) return

    const checkChange = (key: 'home_odds' | 'draw_odds' | 'away_odds', label: string) => {
      const newVal = parseFloat(String(newOdds[key]))
      const oldVal = parseFloat(String(oldOdds[key]))
      if (newVal > oldVal) {
        recentChanges.value[label] = 'up'
      } else if (newVal < oldVal) {
        recentChanges.value[label] = 'down'
      }
    }

    checkChange('home_odds', '1')
    checkChange('draw_odds', 'X')
    checkChange('away_odds', '2')

    // Clear flash after animation
    setTimeout(() => {
      recentChanges.value = {}
    }, 500)
  },
  { deep: true }
)
</script>
