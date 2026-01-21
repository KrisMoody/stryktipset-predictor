<template>
  <div class="space-y-4">
    <!-- Market Odds Table -->
    <div v-if="hasMarketOdds" class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700">
            <th class="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Source</th>
            <th class="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">1</th>
            <th class="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">X</th>
            <th class="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">2</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <!-- Market Odds -->
          <tr v-if="currentOdds">
            <td class="py-2 text-gray-900 dark:text-white">Market Odds</td>
            <td class="py-2 text-center font-medium">{{ formatOdds(currentOdds.home_odds) }}</td>
            <td class="py-2 text-center font-medium">{{ formatOdds(currentOdds.draw_odds) }}</td>
            <td class="py-2 text-center font-medium">{{ formatOdds(currentOdds.away_odds) }}</td>
          </tr>

          <!-- Implied Probability -->
          <tr v-if="currentOdds" class="text-gray-500 dark:text-gray-400">
            <td class="py-2 text-sm">Implied Prob.</td>
            <td class="py-2 text-center text-sm">{{ impliedProb(currentOdds.home_odds) }}%</td>
            <td class="py-2 text-center text-sm">{{ impliedProb(currentOdds.draw_odds) }}%</td>
            <td class="py-2 text-center text-sm">{{ impliedProb(currentOdds.away_odds) }}%</td>
          </tr>

          <!-- Svenska Folket -->
          <tr v-if="svenskaFolketData">
            <td class="py-2 text-gray-900 dark:text-white">Svenska Folket</td>
            <td class="py-2 text-center">{{ svenskaFolketData.one || '—' }}%</td>
            <td class="py-2 text-center">{{ svenskaFolketData.x || '—' }}%</td>
            <td class="py-2 text-center">{{ svenskaFolketData.two || '—' }}%</td>
          </tr>

          <!-- Expert Tips -->
          <tr v-if="expertTipsData">
            <td class="py-2 text-gray-900 dark:text-white">10 Tidningars Tips</td>
            <td class="py-2 text-center">{{ expertTipsData.one || '—' }}</td>
            <td class="py-2 text-center">{{ expertTipsData.x || '—' }}</td>
            <td class="py-2 text-center">{{ expertTipsData.two || '—' }}</td>
          </tr>

          <!-- AI Prediction -->
          <tr v-if="prediction" class="bg-primary-50 dark:bg-primary-900/20">
            <td class="py-2 font-medium text-primary-700 dark:text-primary-400">AI Prediction</td>
            <td class="py-2 text-center font-medium" :class="highlightClass('1')">
              {{ formatProb(prediction.probability_home) }}%
            </td>
            <td class="py-2 text-center font-medium" :class="highlightClass('X')">
              {{ formatProb(prediction.probability_draw) }}%
            </td>
            <td class="py-2 text-center font-medium" :class="highlightClass('2')">
              {{ formatProb(prediction.probability_away) }}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Margin Analysis -->
    <div v-if="currentOdds" class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-500 dark:text-gray-400">Bookmaker Margin</span>
        <span class="font-medium text-gray-900 dark:text-white">{{ margin }}%</span>
      </div>
    </div>

    <!-- No Data State -->
    <div v-if="!hasMarketOdds" class="text-center py-8 text-gray-500 dark:text-gray-400">
      <UIcon name="i-heroicons-scale" class="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p>No odds data available</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface MatchOdds {
  type?: string
  home_odds: string | number
  draw_odds: string | number
  away_odds: string | number
}

interface Prediction {
  predicted_outcome: string
  probability_home: number | string
  probability_draw: number | string
  probability_away: number | string
}

interface ScrapedDataItem {
  data_type: string
  data: unknown
}

const props = defineProps<{
  matchOdds?: MatchOdds[]
  prediction?: Prediction | null
  scrapedData?: ScrapedDataItem[]
}>()

const currentOdds = computed(() => {
  if (!props.matchOdds || props.matchOdds.length === 0) return null
  const current = props.matchOdds.find(o => o.type === 'current')
  return current || props.matchOdds[0]
})

const hasMarketOdds = computed(() => {
  return !!(
    currentOdds.value ||
    svenskaFolketData.value ||
    expertTipsData.value ||
    props.prediction
  )
})

const svenskaFolketData = computed(() => {
  if (!props.scrapedData) return null
  const sf = props.scrapedData.find(d => d.data_type === 'svenskaFolket')
  return sf?.data as { one?: string; x?: string; two?: string } | null
})

const expertTipsData = computed(() => {
  if (!props.scrapedData) return null
  const et = props.scrapedData.find(d => d.data_type === 'expertTips')
  return et?.data as { one?: number; x?: number; two?: number } | null
})

const margin = computed(() => {
  if (!currentOdds.value) return '—'
  const h = Number(currentOdds.value.home_odds)
  const d = Number(currentOdds.value.draw_odds)
  const a = Number(currentOdds.value.away_odds)
  if (!h || !d || !a) return '—'
  const total = (1 / h + 1 / d + 1 / a) * 100
  return (total - 100).toFixed(1)
})

function formatOdds(odds: string | number | undefined): string {
  if (!odds) return '—'
  return Number(odds).toFixed(2)
}

function impliedProb(odds: string | number | undefined): string {
  if (!odds) return '—'
  const prob = (1 / Number(odds)) * 100
  return prob.toFixed(1)
}

function formatProb(prob: string | number): string {
  return (Number(prob) * 100).toFixed(1)
}

function highlightClass(outcome: string): string {
  if (!props.prediction) return ''
  if (props.prediction.predicted_outcome === outcome) {
    return 'text-primary-700 dark:text-primary-400'
  }
  return ''
}
</script>
