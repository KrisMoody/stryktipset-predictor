<template>
  <div class="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
    <div v-if="prediction" class="space-y-3">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div>
          <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            AI Prediction
          </div>
          <div class="text-3xl font-bold text-primary-600 dark:text-primary-400">
            {{ prediction.predicted_outcome }}
          </div>
        </div>
        <V2ConfidenceMeter :confidence="prediction.confidence" />
      </div>

      <!-- Probabilities -->
      <div class="grid grid-cols-3 gap-2 text-center">
        <div
          v-for="prob in probabilities"
          :key="prob.label"
          class="p-2 rounded bg-white/50 dark:bg-gray-800/50"
          :class="{ 'ring-2 ring-primary-500': prob.label === prediction.predicted_outcome }"
        >
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ prob.label }}</div>
          <div class="text-sm font-semibold text-gray-900 dark:text-white">{{ prob.value }}%</div>
        </div>
      </div>

      <!-- Value Badge -->
      <div v-if="bestEV > 0.03" class="flex items-center gap-2">
        <V2ValueBadge :ev="bestEV" />
        <span class="text-xs text-gray-500 dark:text-gray-400"> on {{ bestEVOutcome }} </span>
      </div>

      <!-- Spik Candidate -->
      <div v-if="prediction.is_spik_suitable" class="flex items-center gap-2">
        <UBadge color="warning" variant="soft" size="sm">
          <UIcon name="i-heroicons-star" class="w-3 h-3 mr-1" />
          Spik Candidate
        </UBadge>
      </div>

      <!-- Re-evaluation indicator -->
      <div v-if="prediction.is_reevaluation" class="text-xs text-gray-500 dark:text-gray-400">
        <UIcon name="i-heroicons-arrow-path" class="w-3 h-3 inline mr-1" />
        Re-evaluated prediction
      </div>
    </div>

    <!-- No Prediction State -->
    <div v-else class="text-center py-4">
      <UIcon name="i-heroicons-sparkles" class="w-8 h-8 mx-auto text-gray-400 mb-2" />
      <p class="text-sm text-gray-500 dark:text-gray-400">No prediction yet</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface PredictionData {
  predicted_outcome: string
  confidence: 'low' | 'medium' | 'high' | string
  probability_home: number | string
  probability_draw: number | string
  probability_away: number | string
  is_spik_suitable?: boolean
  is_reevaluation?: boolean
  ev_home?: number
  ev_draw?: number
  ev_away?: number
}

const props = defineProps<{
  prediction: PredictionData | null
  odds?: {
    home_odds: number | string
    draw_odds: number | string
    away_odds: number | string
  } | null
}>()

const probabilities = computed(() => {
  if (!props.prediction) return []

  return [
    {
      label: '1',
      value: (Number(props.prediction.probability_home) * 100).toFixed(1),
    },
    {
      label: 'X',
      value: (Number(props.prediction.probability_draw) * 100).toFixed(1),
    },
    {
      label: '2',
      value: (Number(props.prediction.probability_away) * 100).toFixed(1),
    },
  ]
})

// Calculate EV if odds available
const evValues = computed(() => {
  if (!props.prediction || !props.odds) return { home: 0, draw: 0, away: 0 }

  // If prediction has EV values, use them
  if (props.prediction.ev_home !== undefined) {
    return {
      home: props.prediction.ev_home,
      draw: props.prediction.ev_draw || 0,
      away: props.prediction.ev_away || 0,
    }
  }

  // Otherwise calculate from probabilities and odds
  const probHome = Number(props.prediction.probability_home)
  const probDraw = Number(props.prediction.probability_draw)
  const probAway = Number(props.prediction.probability_away)

  const oddsHome = Number(props.odds.home_odds)
  const oddsDraw = Number(props.odds.draw_odds)
  const oddsAway = Number(props.odds.away_odds)

  return {
    home: probHome * oddsHome - 1,
    draw: probDraw * oddsDraw - 1,
    away: probAway * oddsAway - 1,
  }
})

const bestEV = computed(() => {
  return Math.max(evValues.value.home, evValues.value.draw, evValues.value.away)
})

const bestEVOutcome = computed(() => {
  const { home, draw, away } = evValues.value
  if (home >= draw && home >= away) return 'Home (1)'
  if (draw >= home && draw >= away) return 'Draw (X)'
  return 'Away (2)'
})
</script>
