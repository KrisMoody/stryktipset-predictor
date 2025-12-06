<template>
  <div class="space-y-4">
    <!-- Reasoning Section -->
    <div v-if="prediction?.reasoning">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">AI Analysis</h4>
      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
          {{ prediction.reasoning }}
        </p>
      </div>
    </div>

    <!-- Key Factors Section -->
    <div v-if="keyFactors && keyFactors.length > 0">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Key Factors</h4>
      <ul class="space-y-2">
        <li v-for="(factor, idx) in keyFactors" :key="idx" class="flex items-start gap-2 text-sm">
          <UIcon
            name="i-heroicons-check-circle"
            class="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0"
          />
          <span class="text-gray-700 dark:text-gray-300">{{ factor }}</span>
        </li>
      </ul>
    </div>

    <!-- Similar Matches Section -->
    <div v-if="similarMatches && similarMatches.length > 0">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Similar Historical Matches
      </h4>
      <div class="space-y-2">
        <div
          v-for="(match, idx) in similarMatches"
          :key="idx"
          class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ match.homeTeam || match.home_team }} vs {{ match.awayTeam || match.away_team }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ match.date || match.match_date }}
                <span v-if="match.league || match.competition">
                  &bull; {{ match.league || match.competition }}</span
                >
              </p>
            </div>
            <div class="text-right">
              <UBadge
                v-if="match.score || match.result"
                :color="getOutcomeColor(match.outcome)"
                variant="soft"
                size="sm"
              >
                {{ match.score || match.result }}
              </UBadge>
              <p v-if="match.outcome" class="text-xs text-gray-500 mt-1">
                Outcome: {{ match.outcome }}
              </p>
            </div>
          </div>
          <p v-if="match.similarity" class="text-xs text-gray-500 mt-2">
            {{ (match.similarity * 100).toFixed(0) }}% similar
          </p>
        </div>
      </div>
    </div>

    <!-- User Context Section -->
    <div v-if="prediction?.user_context" class="pt-4 border-t border-gray-200 dark:border-gray-700">
      <h4
        class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2"
      >
        <UIcon name="i-heroicons-user" class="w-4 h-4" />
        User-Provided Context
      </h4>
      <div class="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-3">
        <p class="text-sm text-warning-800 dark:text-warning-200 italic">
          "{{ prediction.user_context }}"
        </p>
        <p class="text-xs text-warning-600 dark:text-warning-400 mt-2">
          This context was considered in generating the prediction.
        </p>
      </div>
    </div>

    <!-- Re-evaluation Badge -->
    <div v-if="prediction?.is_reevaluation" class="pt-2">
      <UBadge color="info" variant="soft" size="sm">
        <UIcon name="i-heroicons-arrow-path" class="w-3 h-3 mr-1" />
        Re-evaluated prediction
      </UBadge>
    </div>

    <!-- Spik Suitability -->
    <div v-if="prediction?.is_spik_suitable" class="pt-2">
      <UBadge color="warning" variant="soft" size="lg" class="gap-1">
        <UIcon name="i-heroicons-star" class="w-4 h-4" />
        Recommended as Spik (Banker)
      </UBadge>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        This match shows high prediction confidence and is suitable for single-outcome betting.
      </p>
    </div>

    <!-- Empty State -->
    <div
      v-if="
        !prediction?.reasoning &&
        (!keyFactors || keyFactors.length === 0) &&
        (!similarMatches || similarMatches.length === 0)
      "
      class="text-center py-6 text-gray-500 dark:text-gray-400"
    >
      <UIcon name="i-heroicons-document-magnifying-glass" class="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p class="text-sm">No detailed analysis available for this match.</p>
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
  is_spik_suitable?: boolean
  user_context?: string
  is_reevaluation?: boolean
}

const props = defineProps<{
  prediction: Prediction | null | undefined
}>()

// Parse key_factors - could be JSON string or array
const keyFactors = computed(() => {
  if (!props.prediction?.key_factors) return []

  if (Array.isArray(props.prediction.key_factors)) {
    return props.prediction.key_factors
  }

  // Try to parse if it's a string
  if (typeof props.prediction.key_factors === 'string') {
    try {
      const parsed = JSON.parse(props.prediction.key_factors)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      // If not valid JSON, return as single item
      return [props.prediction.key_factors]
    }
  }

  return []
})

// Parse similar_matches - could be JSON string or array
const similarMatches = computed(() => {
  if (!props.prediction?.similar_matches) return []

  if (Array.isArray(props.prediction.similar_matches)) {
    return props.prediction.similar_matches
  }

  // Try to parse if it's a string
  if (typeof props.prediction.similar_matches === 'string') {
    try {
      const parsed = JSON.parse(props.prediction.similar_matches)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
})

// Get color for outcome badge
const getOutcomeColor = (outcome: string | undefined) => {
  if (!outcome) return 'neutral'
  switch (outcome) {
    case '1':
      return 'success'
    case 'X':
      return 'warning'
    case '2':
      return 'error'
    default:
      return 'neutral'
  }
}
</script>
