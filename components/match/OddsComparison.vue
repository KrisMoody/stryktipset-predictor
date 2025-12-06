<template>
  <div class="space-y-4">
    <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
      <UIcon
        name="i-heroicons-scale"
        class="w-4 h-4"
      />
      Odds & Distribution Comparison
    </h4>

    <!-- Comparison Table -->
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
              Source
            </th>
            <th class="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">
              1 (Home)
            </th>
            <th class="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">
              X (Draw)
            </th>
            <th class="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">
              2 (Away)
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <!-- Market Odds -->
          <tr v-if="currentOdds">
            <td class="px-3 py-2 text-gray-600 dark:text-gray-400 font-medium">
              Market Odds
            </td>
            <td class="px-3 py-2 text-center font-semibold">
              {{ currentOdds.home_odds }}
            </td>
            <td class="px-3 py-2 text-center font-semibold">
              {{ currentOdds.draw_odds }}
            </td>
            <td class="px-3 py-2 text-center font-semibold">
              {{ currentOdds.away_odds }}
            </td>
          </tr>

          <!-- Implied Probability from Odds -->
          <tr v-if="currentOdds">
            <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
              <span class="text-xs">Implied Prob.</span>
            </td>
            <td class="px-3 py-2 text-center text-sm text-gray-500">
              {{ formatPercent(currentOdds.home_probability) }}
            </td>
            <td class="px-3 py-2 text-center text-sm text-gray-500">
              {{ formatPercent(currentOdds.draw_probability) }}
            </td>
            <td class="px-3 py-2 text-center text-sm text-gray-500">
              {{ formatPercent(currentOdds.away_probability) }}
            </td>
          </tr>

          <!-- Svenska Folket -->
          <tr v-if="svenskaFolket">
            <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
              Svenska Folket
              <UBadge
                color="primary"
                variant="soft"
                size="xs"
                class="ml-1"
              >
                Public
              </UBadge>
            </td>
            <td class="px-3 py-2 text-center">
              <span :class="getHighlightClass('1', svenskaFolket)">
                {{ formatPercent(svenskaFolket.one) }}
              </span>
            </td>
            <td class="px-3 py-2 text-center">
              <span :class="getHighlightClass('X', svenskaFolket)">
                {{ formatPercent(svenskaFolket.x) }}
              </span>
            </td>
            <td class="px-3 py-2 text-center">
              <span :class="getHighlightClass('2', svenskaFolket)">
                {{ formatPercent(svenskaFolket.two) }}
              </span>
            </td>
          </tr>

          <!-- Tio Tidningars Tips -->
          <tr v-if="expertTips">
            <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
              Tio Tidningar
              <UBadge
                color="warning"
                variant="soft"
                size="xs"
                class="ml-1"
              >
                Expert
              </UBadge>
            </td>
            <td class="px-3 py-2 text-center">
              <span :class="getExpertHighlight('1')">
                {{ expertTips.one }}/10
              </span>
            </td>
            <td class="px-3 py-2 text-center">
              <span :class="getExpertHighlight('X')">
                {{ expertTips.x }}/10
              </span>
            </td>
            <td class="px-3 py-2 text-center">
              <span :class="getExpertHighlight('2')">
                {{ expertTips.two }}/10
              </span>
            </td>
          </tr>

          <!-- AI Prediction -->
          <tr v-if="prediction">
            <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
              AI Prediction
              <UBadge
                color="success"
                variant="soft"
                size="xs"
                class="ml-1"
              >
                AI
              </UBadge>
            </td>
            <td class="px-3 py-2 text-center">
              <span :class="prediction.predicted_outcome === '1' ? 'font-bold text-primary-600 dark:text-primary-400' : ''">
                {{ formatPercent(prediction.probability_home) }}
              </span>
            </td>
            <td class="px-3 py-2 text-center">
              <span :class="prediction.predicted_outcome === 'X' ? 'font-bold text-primary-600 dark:text-primary-400' : ''">
                {{ formatPercent(prediction.probability_draw) }}
              </span>
            </td>
            <td class="px-3 py-2 text-center">
              <span :class="prediction.predicted_outcome === '2' ? 'font-bold text-primary-600 dark:text-primary-400' : ''">
                {{ formatPercent(prediction.probability_away) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Visual Bars -->
    <div
      v-if="hasData"
      class="space-y-3"
    >
      <h5 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
        Distribution Comparison
      </h5>

      <!-- Home Win -->
      <div>
        <div class="flex justify-between text-xs mb-1">
          <span class="text-gray-600 dark:text-gray-400">Home Win (1)</span>
        </div>
        <div class="flex gap-1 h-4">
          <div
            v-if="currentOdds"
            :style="{ width: `${parseFloat(toNumberString(currentOdds.home_probability)) || 0}%` }"
            class="bg-blue-500 rounded-sm"
            :title="`Market: ${formatPercent(currentOdds.home_probability)}`"
          />
          <div
            v-if="svenskaFolket"
            :style="{ width: `${parseFloat(svenskaFolket.one) || 0}%` }"
            class="bg-purple-500 rounded-sm"
            :title="`Svenska Folket: ${formatPercent(svenskaFolket.one)}`"
          />
          <div
            v-if="prediction"
            :style="{ width: `${Number(prediction.probability_home) * 100 || 0}%` }"
            class="bg-green-500 rounded-sm"
            :title="`AI: ${formatPercent(prediction.probability_home)}`"
          />
        </div>
      </div>

      <!-- Draw -->
      <div>
        <div class="flex justify-between text-xs mb-1">
          <span class="text-gray-600 dark:text-gray-400">Draw (X)</span>
        </div>
        <div class="flex gap-1 h-4">
          <div
            v-if="currentOdds"
            :style="{ width: `${parseFloat(toNumberString(currentOdds.draw_probability)) || 0}%` }"
            class="bg-blue-500 rounded-sm"
            :title="`Market: ${formatPercent(currentOdds.draw_probability)}`"
          />
          <div
            v-if="svenskaFolket"
            :style="{ width: `${parseFloat(svenskaFolket.x) || 0}%` }"
            class="bg-purple-500 rounded-sm"
            :title="`Svenska Folket: ${formatPercent(svenskaFolket.x)}`"
          />
          <div
            v-if="prediction"
            :style="{ width: `${Number(prediction.probability_draw) * 100 || 0}%` }"
            class="bg-green-500 rounded-sm"
            :title="`AI: ${formatPercent(prediction.probability_draw)}`"
          />
        </div>
      </div>

      <!-- Away Win -->
      <div>
        <div class="flex justify-between text-xs mb-1">
          <span class="text-gray-600 dark:text-gray-400">Away Win (2)</span>
        </div>
        <div class="flex gap-1 h-4">
          <div
            v-if="currentOdds"
            :style="{ width: `${parseFloat(toNumberString(currentOdds.away_probability)) || 0}%` }"
            class="bg-blue-500 rounded-sm"
            :title="`Market: ${formatPercent(currentOdds.away_probability)}`"
          />
          <div
            v-if="svenskaFolket"
            :style="{ width: `${parseFloat(svenskaFolket.two) || 0}%` }"
            class="bg-purple-500 rounded-sm"
            :title="`Svenska Folket: ${formatPercent(svenskaFolket.two)}`"
          />
          <div
            v-if="prediction"
            :style="{ width: `${Number(prediction.probability_away) * 100 || 0}%` }"
            class="bg-green-500 rounded-sm"
            :title="`AI: ${formatPercent(prediction.probability_away)}`"
          />
        </div>
      </div>

      <!-- Legend -->
      <div class="flex flex-wrap gap-4 text-xs pt-2">
        <div
          v-if="currentOdds"
          class="flex items-center gap-1"
        >
          <span class="w-3 h-3 bg-blue-500 rounded-sm" />
          <span class="text-gray-600 dark:text-gray-400">Market</span>
        </div>
        <div
          v-if="svenskaFolket"
          class="flex items-center gap-1"
        >
          <span class="w-3 h-3 bg-purple-500 rounded-sm" />
          <span class="text-gray-600 dark:text-gray-400">Svenska Folket</span>
        </div>
        <div
          v-if="prediction"
          class="flex items-center gap-1"
        >
          <span class="w-3 h-3 bg-green-500 rounded-sm" />
          <span class="text-gray-600 dark:text-gray-400">AI</span>
        </div>
      </div>
    </div>

    <!-- Value Bet Indicators -->
    <div
      v-if="valueBets.length > 0"
      class="pt-2"
    >
      <h5 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
        Potential Value Bets
      </h5>
      <div class="flex flex-wrap gap-2">
        <UBadge
          v-for="bet in valueBets"
          :key="bet.outcome"
          color="success"
          variant="soft"
        >
          {{ bet.outcome }}: AI {{ bet.aiProb }}% vs Public {{ bet.publicProb }}% (+{{ bet.edge }}%)
        </UBadge>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="!hasData"
      class="text-center py-6 text-gray-500 dark:text-gray-400"
    >
      <UIcon
        name="i-heroicons-scale"
        class="w-8 h-8 mx-auto mb-2 opacity-50"
      />
      <p class="text-sm">
        No odds comparison data available.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface MatchOdds {
  home_odds: string | number
  draw_odds: string | number
  away_odds: string | number
  home_probability: string | number
  draw_probability: string | number
  away_probability: string | number
  svenska_folket_home?: string
  svenska_folket_draw?: string
  svenska_folket_away?: string
  tio_tidningars_tips_home?: string
  tio_tidningars_tips_draw?: string
  tio_tidningars_tips_away?: string
}

interface Prediction {
  probability_home: string | number
  probability_draw: string | number
  probability_away: string | number
  predicted_outcome: string
}

interface SvenskaFolket {
  one: string
  x: string
  two: string
}

interface ExpertTips {
  one: number
  x: number
  two: number
}

const props = defineProps<{
  matchOdds: MatchOdds[] | null | undefined
  prediction: Prediction | null | undefined
  scrapedData?: Array<{ data_type: string, data: any }> | null
}>()

// Get current (most recent) odds
const currentOdds = computed(() => {
  if (!props.matchOdds || props.matchOdds.length === 0) return null
  return props.matchOdds[0]
})

// Extract Svenska Folket data - first from match_odds, then from scraped data
const svenskaFolket = computed((): SvenskaFolket | null => {
  // Try match_odds first
  if (currentOdds.value) {
    const { svenska_folket_home, svenska_folket_draw, svenska_folket_away } = currentOdds.value
    if (svenska_folket_home || svenska_folket_draw || svenska_folket_away) {
      return {
        one: svenska_folket_home || '0',
        x: svenska_folket_draw || '0',
        two: svenska_folket_away || '0',
      }
    }
  }

  // Fallback to scraped data
  if (props.scrapedData) {
    const sfData = props.scrapedData.find(d => d.data_type === 'svenskaFolket')
    if (sfData?.data) {
      return {
        one: sfData.data.one || '0',
        x: sfData.data.x || '0',
        two: sfData.data.two || '0',
      }
    }
  }

  return null
})

// Extract expert tips - first from match_odds, then from scraped data
const expertTips = computed((): ExpertTips | null => {
  // Try match_odds first
  if (currentOdds.value) {
    const { tio_tidningars_tips_home, tio_tidningars_tips_draw, tio_tidningars_tips_away } = currentOdds.value
    if (tio_tidningars_tips_home || tio_tidningars_tips_draw || tio_tidningars_tips_away) {
      return {
        one: parseInt(tio_tidningars_tips_home || '0'),
        x: parseInt(tio_tidningars_tips_draw || '0'),
        two: parseInt(tio_tidningars_tips_away || '0'),
      }
    }
  }

  // Fallback to scraped data
  if (props.scrapedData) {
    const etData = props.scrapedData.find(d => d.data_type === 'expertTips')
    if (etData?.data) {
      return {
        one: etData.data.one ?? 0,
        x: etData.data.x ?? 0,
        two: etData.data.two ?? 0,
      }
    }
  }

  return null
})

// Check if we have any data to display
const hasData = computed(() => {
  return currentOdds.value || svenskaFolket.value || props.prediction
})

// Format percentage
const formatPercent = (value: string | number | undefined) => {
  if (value === undefined || value === null) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  // If already a percentage (> 1), just format it
  if (num > 1) return `${num.toFixed(1)}%`
  // If decimal probability, convert to percentage
  return `${(num * 100).toFixed(1)}%`
}

// Convert value to string for parseFloat
const toNumberString = (value: string | number | undefined): string => {
  if (value === undefined || value === null) return '0'
  return String(value)
}

// Highlight highest in Svenska Folket
const getHighlightClass = (outcome: string, sf: SvenskaFolket) => {
  const values = [
    { o: '1', v: parseFloat(sf.one) },
    { o: 'X', v: parseFloat(sf.x) },
    { o: '2', v: parseFloat(sf.two) },
  ]
  const max = Math.max(...values.map(v => v.v))
  const found = values.find(v => v.o === outcome)
  return found?.v === max ? 'font-bold text-purple-600 dark:text-purple-400' : ''
}

// Highlight expert consensus
const getExpertHighlight = (outcome: string) => {
  if (!expertTips.value) return ''
  const values = [
    { o: '1', v: expertTips.value.one },
    { o: 'X', v: expertTips.value.x },
    { o: '2', v: expertTips.value.two },
  ]
  const max = Math.max(...values.map(v => v.v))
  const found = values.find(v => v.o === outcome)
  return found?.v === max ? 'font-bold text-amber-600 dark:text-amber-400' : ''
}

// Calculate value bets (AI prob > public prob by margin)
const valueBets = computed(() => {
  if (!props.prediction || !svenskaFolket.value) return []

  const bets: Array<{ outcome: string, aiProb: string, publicProb: string, edge: string }> = []
  const minEdge = 5 // Minimum edge percentage to consider

  const comparisons = [
    { outcome: '1', ai: Number(props.prediction.probability_home), pub: parseFloat(svenskaFolket.value.one) },
    { outcome: 'X', ai: Number(props.prediction.probability_draw), pub: parseFloat(svenskaFolket.value.x) },
    { outcome: '2', ai: Number(props.prediction.probability_away), pub: parseFloat(svenskaFolket.value.two) },
  ]

  for (const { outcome, ai, pub } of comparisons) {
    // AI prob is in decimal (0-1), public is percentage
    const aiPercent = ai > 1 ? ai : ai * 100
    const edge = aiPercent - pub

    if (edge >= minEdge) {
      bets.push({
        outcome,
        aiProb: aiPercent.toFixed(1),
        publicProb: pub.toFixed(1),
        edge: edge.toFixed(1),
      })
    }
  }

  return bets
})
</script>
