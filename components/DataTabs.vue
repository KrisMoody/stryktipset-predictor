<template>
  <div>
    <!-- Tab Navigation -->
    <div class="data-tabs flex gap-1 overflow-x-auto" role="tablist">
      <button
        v-for="tab in tabs"
        :id="`tab-${tab.id}`"
        :key="tab.id"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :aria-controls="`panel-${tab.id}`"
        class="data-tab whitespace-nowrap"
        :class="{
          'data-tab--active': activeTab === tab.id,
          'data-tab--has-data': tab.hasData,
        }"
        @click="activeTab = tab.id"
      >
        <UIcon :name="tab.icon" class="w-4 h-4 mr-1.5 inline" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Panels -->
    <div class="mt-4">
      <div
        v-show="activeTab === 'analysis'"
        id="panel-analysis"
        role="tabpanel"
        :aria-labelledby="'tab-analysis'"
      >
        <AIAnalysis :prediction="mappedPredictionForAnalysis" />
      </div>

      <div
        v-show="activeTab === 'statistics'"
        id="panel-statistics"
        role="tabpanel"
        :aria-labelledby="'tab-statistics'"
      >
        <MatchStatistics
          :scraped-data="mappedScrapedData"
          :home-team-name="match.homeTeam.name"
          :away-team-name="match.awayTeam.name"
        />
      </div>

      <div v-show="activeTab === 'h2h'" id="panel-h2h" role="tabpanel" :aria-labelledby="'tab-h2h'">
        <HeadToHead
          :scraped-data="mappedScrapedData"
          :home-team-name="match.homeTeam.name"
          :away-team-name="match.awayTeam.name"
        />
      </div>

      <div
        v-show="activeTab === 'odds'"
        id="panel-odds"
        role="tabpanel"
        :aria-labelledby="'tab-odds'"
      >
        <OddsComparison
          :match-odds="mappedMatchOdds"
          :prediction="mappedPredictionForOdds"
          :scraped-data="mappedScrapedData"
        />
      </div>

      <div
        v-show="activeTab === 'model'"
        id="panel-model"
        role="tabpanel"
        :aria-labelledby="'tab-model'"
      >
        <MatchModelAnalysis
          :match-id="match.id"
          :home-team-name="match.homeTeam.name"
          :away-team-name="match.awayTeam.name"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Types matching the child component expectations
interface ScrapedDataItem {
  data_type: string
  data: unknown
}

interface MatchOddsItem {
  type?: string
  home_odds: string | number
  draw_odds: string | number
  away_odds: string | number
}

interface SimilarMatch {
  homeTeam?: string
  home_team?: string
  awayTeam?: string
  away_team?: string
  date?: string
  match_date?: string
  league?: string
  competition?: string
  score?: string
  result?: string
  outcome?: string
  similarity?: number
}

// Input types - flexible to accept various data shapes
interface MatchData {
  id: number
  homeTeam: { name: string }
  awayTeam: { name: string }
  match_odds?: MatchOddsItem[]
  match_scraped_data?: ScrapedDataItem[]
  predictions?: unknown[]
}

interface PredictionData {
  predicted_outcome?: string
  confidence?: string
  reasoning?: string
  key_factors?: string[] | string
  similar_matches?: SimilarMatch[] | string
  probability_home?: number | string
  probability_draw?: number | string
  probability_away?: number | string
  user_context?: string
}

const props = defineProps<{
  match: MatchData
  prediction: PredictionData | null
}>()

const activeTab = ref('analysis')

// Mappers to convert data to child component expected types
const mappedScrapedData = computed((): ScrapedDataItem[] | undefined => {
  return props.match.match_scraped_data
})

const mappedMatchOdds = computed((): MatchOddsItem[] | undefined => {
  return props.match.match_odds
})

const mappedPredictionForAnalysis = computed(() => {
  if (!props.prediction) return null
  return {
    reasoning: props.prediction.reasoning,
    key_factors: props.prediction.key_factors,
    similar_matches: props.prediction.similar_matches,
    user_context: props.prediction.user_context,
  }
})

const mappedPredictionForOdds = computed(() => {
  if (!props.prediction) return null
  const pred = props.prediction
  // OddsComparison requires predicted_outcome and probabilities
  if (!pred.predicted_outcome) return null
  return {
    predicted_outcome: pred.predicted_outcome,
    probability_home: pred.probability_home ?? 0,
    probability_draw: pred.probability_draw ?? 0,
    probability_away: pred.probability_away ?? 0,
  }
})

// Check if each tab has data
const hasAnalysisData = computed(() => {
  return !!(
    props.prediction?.reasoning ||
    props.prediction?.key_factors ||
    props.prediction?.similar_matches
  )
})

const hasStatisticsData = computed(() => {
  if (!props.match.match_scraped_data) return false
  return props.match.match_scraped_data.some(d => {
    if (d.data_type === 'xStats' || d.data_type === 'statistics') {
      return d.data && Object.keys(d.data as object).length > 0
    }
    return false
  })
})

const hasH2HData = computed(() => {
  if (!props.match.match_scraped_data) return false
  const h2h = props.match.match_scraped_data.find(d => d.data_type === 'headToHead')
  const data = h2h?.data as { matches?: unknown[] } | undefined
  return !!(data?.matches && data.matches.length > 0)
})

const hasOddsData = computed(() => {
  return !!(props.match.match_odds && props.match.match_odds.length > 0)
})

const tabs = computed(() => [
  {
    id: 'analysis',
    label: 'AI Analysis',
    icon: 'i-heroicons-sparkles',
    hasData: hasAnalysisData.value,
  },
  {
    id: 'statistics',
    label: 'Statistics',
    icon: 'i-heroicons-chart-bar',
    hasData: hasStatisticsData.value,
  },
  {
    id: 'h2h',
    label: 'Head-to-Head',
    icon: 'i-heroicons-users',
    hasData: hasH2HData.value,
  },
  {
    id: 'odds',
    label: 'Odds Comparison',
    icon: 'i-heroicons-scale',
    hasData: hasOddsData.value,
  },
  {
    id: 'model',
    label: 'Model Analysis',
    icon: 'i-heroicons-calculator',
    hasData: true, // Always available (fetched on demand)
  },
])
</script>
