<template>
  <div class="space-y-6">
    <!-- xStats Section -->
    <div v-if="normalizedXStats">
      <h4
        class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"
      >
        <UIcon name="i-heroicons-chart-bar" class="w-4 h-4" aria-hidden="true" />
        Expected Goals (xStats)
      </h4>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Home Team xStats -->
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h5 class="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3">
            {{ homeTeamName }}
          </h5>
          <div class="space-y-2">
            <XStatRow
              v-if="normalizedXStats.homeTeam?.entireSeason"
              label="Season"
              :data="normalizedXStats.homeTeam.entireSeason"
            />
            <XStatRow
              v-if="normalizedXStats.homeTeam?.lastFiveGames"
              label="Last 5"
              :data="normalizedXStats.homeTeam.lastFiveGames"
            />
            <XStatRow
              v-if="normalizedXStats.homeTeam?.entireSeasonHome"
              label="Home"
              :data="normalizedXStats.homeTeam.entireSeasonHome"
            />
          </div>
        </div>

        <!-- Away Team xStats -->
        <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <h5 class="text-sm font-medium text-red-700 dark:text-red-300 mb-3">
            {{ awayTeamName }}
          </h5>
          <div class="space-y-2">
            <XStatRow
              v-if="normalizedXStats.awayTeam?.entireSeason"
              label="Season"
              :data="normalizedXStats.awayTeam.entireSeason"
            />
            <XStatRow
              v-if="normalizedXStats.awayTeam?.lastFiveGames"
              label="Last 5"
              :data="normalizedXStats.awayTeam.lastFiveGames"
            />
            <XStatRow
              v-if="normalizedXStats.awayTeam?.entireSeasonAway"
              label="Away"
              :data="normalizedXStats.awayTeam.entireSeasonAway"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Team Statistics Section -->
    <div v-if="statisticsData">
      <h4
        class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"
      >
        <UIcon name="i-heroicons-table-cells" class="w-4 h-4" aria-hidden="true" />
        Team Statistics
      </h4>

      <!-- Only show table if we have table data -->
      <div v-if="hasTableData" class="overflow-x-auto">
        <table class="w-full text-sm">
          <caption class="sr-only">
            Lagstatistik för
            {{
              homeTeamName
            }}
            och
            {{
              awayTeamName
            }}
          </caption>
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th
                scope="col"
                class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400"
              >
                Stat
              </th>
              <th
                scope="col"
                class="px-3 py-2 text-center font-medium text-blue-600 dark:text-blue-400"
              >
                {{ homeTeamName }}
              </th>
              <th
                scope="col"
                class="px-3 py-2 text-center font-medium text-red-600 dark:text-red-400"
              >
                {{ awayTeamName }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-if="hasStatValue('position')">
              <th
                scope="row"
                class="px-3 py-2 text-left font-normal text-gray-600 dark:text-gray-400"
              >
                Position
              </th>
              <td class="px-3 py-2 text-center font-semibold">
                {{ statisticsData.homeTeam?.position || '-' }}
              </td>
              <td class="px-3 py-2 text-center font-semibold">
                {{ statisticsData.awayTeam?.position || '-' }}
              </td>
            </tr>
            <tr v-if="hasStatValue('points')">
              <th
                scope="row"
                class="px-3 py-2 text-left font-normal text-gray-600 dark:text-gray-400"
              >
                Points
              </th>
              <td class="px-3 py-2 text-center">
                {{ statisticsData.homeTeam?.points || '-' }}
              </td>
              <td class="px-3 py-2 text-center">
                {{ statisticsData.awayTeam?.points || '-' }}
              </td>
            </tr>
            <tr v-if="hasStatValue('played')">
              <th
                scope="row"
                class="px-3 py-2 text-left font-normal text-gray-600 dark:text-gray-400"
              >
                Played
              </th>
              <td class="px-3 py-2 text-center">
                {{ statisticsData.homeTeam?.played || '-' }}
              </td>
              <td class="px-3 py-2 text-center">
                {{ statisticsData.awayTeam?.played || '-' }}
              </td>
            </tr>
            <tr v-if="hasStatValue('won')">
              <th
                scope="row"
                class="px-3 py-2 text-left font-normal text-gray-600 dark:text-gray-400"
              >
                W / D / L
              </th>
              <td class="px-3 py-2 text-center">
                <span class="text-green-600">{{ statisticsData.homeTeam?.won || 0 }}</span> /
                <span class="text-yellow-600">{{ statisticsData.homeTeam?.drawn || 0 }}</span> /
                <span class="text-red-600">{{ statisticsData.homeTeam?.lost || 0 }}</span>
              </td>
              <td class="px-3 py-2 text-center">
                <span class="text-green-600">{{ statisticsData.awayTeam?.won || 0 }}</span> /
                <span class="text-yellow-600">{{ statisticsData.awayTeam?.drawn || 0 }}</span> /
                <span class="text-red-600">{{ statisticsData.awayTeam?.lost || 0 }}</span>
              </td>
            </tr>
            <tr v-if="hasStatValue('goalsFor')">
              <th
                scope="row"
                class="px-3 py-2 text-left font-normal text-gray-600 dark:text-gray-400"
              >
                Goals (F / A)
              </th>
              <td class="px-3 py-2 text-center">
                {{ statisticsData.homeTeam?.goalsFor || 0 }} /
                {{ statisticsData.homeTeam?.goalsAgainst || 0 }}
              </td>
              <td class="px-3 py-2 text-center">
                {{ statisticsData.awayTeam?.goalsFor || 0 }} /
                {{ statisticsData.awayTeam?.goalsAgainst || 0 }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Message when only form data exists -->
      <p v-if="!hasTableData && hasForm" class="text-xs text-gray-500 dark:text-gray-400 mb-2">
        League table data not available
      </p>

      <!-- Form Section - always show if form data exists -->
      <div v-if="hasForm" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-if="statisticsData.homeTeam?.form" class="flex items-center gap-2">
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ homeTeamName }} form:</span>
          <div class="flex gap-1">
            <span
              v-for="(result, idx) in statisticsData.homeTeam.form.slice(0, 5)"
              :key="idx"
              :class="getFormClass(result)"
              class="w-6 h-6 rounded text-xs font-bold flex items-center justify-center"
            >
              {{ result }}
            </span>
          </div>
        </div>
        <div v-if="statisticsData.awayTeam?.form" class="flex items-center gap-2">
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ awayTeamName }} form:</span>
          <div class="flex gap-1">
            <span
              v-for="(result, idx) in statisticsData.awayTeam.form.slice(0, 5)"
              :key="idx"
              :class="getFormClass(result)"
              class="w-6 h-6 rounded text-xs font-bold flex items-center justify-center"
            >
              {{ result }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="!normalizedXStats && !statisticsData"
      class="text-center py-6 text-gray-500 dark:text-gray-400"
    >
      <UIcon name="i-heroicons-chart-bar" class="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p class="text-sm">No statistics data available for this match.</p>
      <p class="text-xs mt-1">Try scraping the match to fetch statistics.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { XStatsData, StatisticsData, XStatsValues } from '~/types'

interface ScrapedDataItem {
  data_type: string
  data: unknown
}

const props = defineProps<{
  scrapedData: Array<ScrapedDataItem> | null | undefined
  homeTeamName: string
  awayTeamName: string
}>()

// Extract xStats data
const xStatsData = computed((): XStatsData | null => {
  if (!props.scrapedData) return null
  const xStats = props.scrapedData.find(d => d.data_type === 'xStats')
  if (!xStats?.data) return null
  const data = xStats.data as XStatsData
  // Validate required shape
  if (!('homeTeam' in data) || !('awayTeam' in data)) return null
  return data
})

// Helper to normalize team xStats from old format (goalStats) to new format (entireSeason)
/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic scraped data structure */
function normalizeTeamXStats(team: any): any {
  if (!team) return null
  if (team.entireSeason) return team // Already in new format

  // Convert from goalStats format
  return {
    entireSeason: team.goalStats
      ? {
          xg: team.goalStats.xg,
          xga: team.goalStats.xgc, // xgc -> xga
          xgd: team.goalStats.xgd,
          xp: team.expectedPoints?.xp,
        }
      : null,
    name: team.name,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Normalize xStats to handle both old (goalStats) and new (entireSeason) formats
const normalizedXStats = computed((): XStatsData | null => {
  if (!xStatsData.value) return null
  const data = xStatsData.value

  // Check if it's the old format with goalStats
  /* eslint-disable @typescript-eslint/no-explicit-any -- Check for legacy data structure */
  const hasOldFormat = (data.homeTeam as any)?.goalStats || (data.awayTeam as any)?.goalStats
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (hasOldFormat) {
    return {
      homeTeam: normalizeTeamXStats(data.homeTeam),
      awayTeam: normalizeTeamXStats(data.awayTeam),
    } as XStatsData
  }
  return data // Already in new format
})

// Extract statistics data
const statisticsData = computed((): StatisticsData | null => {
  if (!props.scrapedData) return null
  const stats = props.scrapedData.find(d => d.data_type === 'statistics')
  if (!stats?.data) return null
  const data = stats.data as StatisticsData
  // Validate required shape
  if (!('homeTeam' in data) || !('awayTeam' in data)) return null
  return data
})

// Check if a stat exists for either team
const hasStatValue = (key: string) => {
  if (!statisticsData.value) return false
  return (
    statisticsData.value.homeTeam?.[key] !== undefined ||
    statisticsData.value.awayTeam?.[key] !== undefined
  )
}

// Check if any table data exists (position, points, played, etc.)
const hasTableData = computed(() => {
  if (!statisticsData.value) return false
  return (
    hasStatValue('position') ||
    hasStatValue('points') ||
    hasStatValue('played') ||
    hasStatValue('won') ||
    hasStatValue('goalsFor')
  )
})

// Check if form data exists
const hasForm = computed(() => {
  return (
    statisticsData.value?.homeTeam?.form?.length || statisticsData.value?.awayTeam?.form?.length
  )
})

// Get CSS class for form result
const getFormClass = (result: string) => {
  const r = result.toUpperCase()
  if (r === 'W' || r === 'V') return 'bg-green-500 text-white'
  if (r === 'D' || r === 'O') return 'bg-yellow-500 text-white'
  if (r === 'L' || r === 'F') return 'bg-red-500 text-white'
  return 'bg-gray-300 text-gray-700'
}

// XStatRow sub-component (inline)
const XStatRow = defineComponent({
  props: {
    label: { type: String, required: true },
    data: { type: Object as PropType<XStatsValues>, required: true },
  },
  setup(props) {
    return () => {
      if (!props.data) return null
      const { xg, xga, xgd, xp } = props.data
      if (!xg && !xga && !xgd && !xp) return null

      return h('div', { class: 'text-xs' }, [
        h('span', { class: 'text-gray-500 dark:text-gray-400 mr-2' }, props.label + ':'),
        xg && h('span', { class: 'mr-2' }, ['xG: ', h('strong', xg)]),
        xga && h('span', { class: 'mr-2' }, ['xGA: ', h('strong', xga)]),
        xgd && h('span', { class: 'mr-2' }, ['xGD: ', h('strong', xgd)]),
        xp && h('span', {}, ['xP: ', h('strong', xp)]),
      ])
    }
  },
})
</script>
