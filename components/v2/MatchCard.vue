<template>
  <div class="match-card-v2">
    <!-- Header -->
    <div class="match-card-v2__header">
      <div class="flex items-start justify-between gap-4">
        <!-- Match Info -->
        <div class="flex items-start gap-3 min-w-0">
          <div class="text-2xl font-bold text-primary-500 flex-shrink-0">
            {{ match.match_number }}
          </div>
          <div class="min-w-0">
            <div class="font-semibold text-gray-900 dark:text-white truncate">
              {{ match.homeTeam.name }} vs {{ match.awayTeam.name }}
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400 truncate">
              {{ match.league.name }}
              <span v-if="match.league.country"> • {{ match.league.country.name }}</span>
            </div>
          </div>
        </div>

        <!-- Kickoff & Actions -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-sm text-gray-500 dark:text-gray-400">
            {{ formatKickoff }}
          </span>
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            :loading="fetching"
            :disabled="!canFetch"
            @click="$emit('fetch')"
          >
            <UIcon name="i-heroicons-arrow-down-tray" class="w-3 h-3" />
          </UButton>
          <UButton
            size="xs"
            color="primary"
            :loading="predicting"
            :disabled="!canPredict"
            @click="$emit('predict')"
          >
            Predict
          </UButton>
          <UButton
            v-if="hasPrediction"
            size="xs"
            color="warning"
            variant="soft"
            :disabled="predicting || !canPredict"
            @click="$emit('reevaluate')"
          >
            <UIcon name="i-heroicons-arrow-path" class="w-3 h-3" />
          </UButton>
        </div>
      </div>
    </div>

    <!-- Body: Two Column Layout -->
    <div class="match-card-v2__body">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Left: Odds -->
        <div>
          <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Market Odds
          </div>
          <V2OddsTicker :odds="currentOdds" />
        </div>

        <!-- Right: Prediction -->
        <div>
          <V2PredictionPanel :prediction="prediction" :odds="currentOdds" />
        </div>
      </div>
    </div>

    <!-- Footer: Data Tabs -->
    <div class="match-card-v2__footer">
      <V2DataTabs :match="match" :prediction="mappedPredictionForDataTabs" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Team {
  id: number
  name: string
  short_name?: string
}

interface League {
  name: string
  country?: { name: string }
}

interface Prediction {
  predicted_outcome: string
  confidence: string
  probability_home: number | string
  probability_draw: number | string
  probability_away: number | string
  is_spik_suitable?: boolean
  is_reevaluation?: boolean
  reasoning?: string
  key_factors?: string[] | string
  similar_matches?: unknown[]
}

interface MatchOdds {
  type?: string
  home_odds: string | number
  draw_odds: string | number
  away_odds: string | number
}

interface ScrapedData {
  data_type: string
  data: unknown
}

interface MatchData {
  id: number
  match_number: number
  homeTeam: Team
  awayTeam: Team
  league: League
  start_time: string
  predictions?: Prediction[]
  match_odds?: MatchOdds[]
  match_scraped_data?: ScrapedData[]
}

const props = defineProps<{
  match: MatchData
  predicting?: boolean
  canPredict?: boolean
  fetching?: boolean
  canFetch?: boolean
}>()

defineEmits<{
  predict: []
  reevaluate: []
  fetch: []
}>()

const prediction = computed(() => props.match.predictions?.[0] || null)
const hasPrediction = computed(() => !!prediction.value)

// Map prediction for DataTabs which expects a more specific similar_matches type
const mappedPredictionForDataTabs = computed(() => {
  const pred = prediction.value
  if (!pred) return null
  return {
    predicted_outcome: pred.predicted_outcome,
    confidence: pred.confidence,
    reasoning: pred.reasoning,
    key_factors: pred.key_factors,
    similar_matches: pred.similar_matches as
      | {
          homeTeam?: string
          awayTeam?: string
          date?: string
          league?: string
          score?: string
          similarity?: number
        }[]
      | string
      | undefined,
    probability_home: pred.probability_home,
    probability_draw: pred.probability_draw,
    probability_away: pred.probability_away,
  }
})

interface OddsData {
  home_odds: string | number
  draw_odds: string | number
  away_odds: string | number
}

const currentOdds = computed((): OddsData | null => {
  if (!props.match.match_odds || props.match.match_odds.length === 0) return null
  // Prefer 'current' odds, fallback to first
  const current = props.match.match_odds.find(o => o.type === 'current')
  const odds = current || props.match.match_odds[0]
  if (!odds) return null
  return {
    home_odds: odds.home_odds,
    draw_odds: odds.draw_odds,
    away_odds: odds.away_odds,
  }
})

const formatKickoff = computed(() => {
  return new Date(props.match.start_time).toLocaleString('sv-SE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})
</script>
