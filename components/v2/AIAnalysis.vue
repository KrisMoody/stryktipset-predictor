<template>
  <div class="space-y-4">
    <!-- Reasoning -->
    <div v-if="prediction?.reasoning">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Analysis</h4>
      <p class="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
        {{ prediction.reasoning }}
      </p>
    </div>

    <!-- Key Factors -->
    <div v-if="keyFactors.length > 0">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Key Factors</h4>
      <ul class="space-y-2">
        <li
          v-for="(factor, index) in keyFactors"
          :key="index"
          class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
        >
          <UIcon
            name="i-heroicons-check-circle"
            class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"
          />
          <span>{{ factor }}</span>
        </li>
      </ul>
    </div>

    <!-- Similar Matches -->
    <div v-if="similarMatches.length > 0">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">
        Similar Historical Matches
      </h4>
      <div class="space-y-2">
        <div
          v-for="(match, index) in similarMatches"
          :key="index"
          class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="font-medium text-gray-900 dark:text-white">
              {{ match.homeTeam }} vs {{ match.awayTeam }}
            </span>
            <span class="text-gray-500 dark:text-gray-400">{{ match.date }}</span>
          </div>
          <div class="flex items-center gap-4 text-gray-600 dark:text-gray-400">
            <span>{{ match.league }}</span>
            <span class="font-medium">{{ match.score }}</span>
            <span
              v-if="match.similarity"
              class="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded"
            >
              {{ (match.similarity * 100).toFixed(0) }}% similar
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- User Context (if re-evaluation) -->
    <div v-if="prediction?.user_context">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Additional Context</h4>
      <p class="text-sm text-gray-600 dark:text-gray-400 italic">"{{ prediction.user_context }}"</p>
    </div>

    <!-- No Data State -->
    <div v-if="!hasAnyData" class="text-center py-8 text-gray-500 dark:text-gray-400">
      <UIcon name="i-heroicons-sparkles" class="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p>No analysis data available</p>
      <p class="text-xs mt-1">Generate a prediction to see AI analysis</p>
    </div>
  </div>
</template>

<script setup lang="ts">
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

interface Prediction {
  reasoning?: string
  key_factors?: string[] | string
  similar_matches?: SimilarMatch[] | string
  user_context?: string
}

const props = defineProps<{
  prediction?: Prediction | null
}>()

const keyFactors = computed(() => {
  if (!props.prediction?.key_factors) return []
  if (typeof props.prediction.key_factors === 'string') {
    try {
      return JSON.parse(props.prediction.key_factors)
    } catch {
      return props.prediction.key_factors.split('\n').filter(Boolean)
    }
  }
  return props.prediction.key_factors
})

const similarMatches = computed(() => {
  if (!props.prediction?.similar_matches) return []
  let matches: SimilarMatch[] = []
  if (typeof props.prediction.similar_matches === 'string') {
    try {
      matches = JSON.parse(props.prediction.similar_matches)
    } catch {
      return []
    }
  } else {
    matches = props.prediction.similar_matches
  }

  // Normalize field names
  return matches.map(m => ({
    homeTeam: m.homeTeam || m.home_team || 'Unknown',
    awayTeam: m.awayTeam || m.away_team || 'Unknown',
    date: m.date || m.match_date || '',
    league: m.league || m.competition || '',
    score: m.score || m.result || m.outcome || '',
    similarity: m.similarity,
  }))
})

const hasAnyData = computed(() => {
  return !!(
    props.prediction?.reasoning ||
    keyFactors.value.length > 0 ||
    similarMatches.value.length > 0
  )
})
</script>
