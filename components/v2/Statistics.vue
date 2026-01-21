<template>
  <div class="space-y-4">
    <!-- xG Stats -->
    <div v-if="xgStats" class="overflow-x-auto">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Expected Goals (xG)</h4>
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700">
            <th class="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Team</th>
            <th class="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">xG</th>
            <th class="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">xGA</th>
            <th class="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">xPts</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr>
            <td class="py-2 text-gray-900 dark:text-white">{{ homeTeamName }}</td>
            <td class="py-2 text-center font-medium">{{ xgStats.home.xg ?? '—' }}</td>
            <td class="py-2 text-center">{{ xgStats.home.xga ?? '—' }}</td>
            <td class="py-2 text-center">{{ xgStats.home.xpts ?? '—' }}</td>
          </tr>
          <tr>
            <td class="py-2 text-gray-900 dark:text-white">{{ awayTeamName }}</td>
            <td class="py-2 text-center font-medium">{{ xgStats.away.xg ?? '—' }}</td>
            <td class="py-2 text-center">{{ xgStats.away.xga ?? '—' }}</td>
            <td class="py-2 text-center">{{ xgStats.away.xpts ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Team Stats -->
    <div v-if="teamStats" class="overflow-x-auto">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">League Position</h4>
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700">
            <th class="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Team</th>
            <th class="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">Pos</th>
            <th class="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">Pts</th>
            <th class="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">GD</th>
            <th class="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">Form</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr>
            <td class="py-2 text-gray-900 dark:text-white">{{ homeTeamName }}</td>
            <td class="py-2 text-center font-medium">{{ teamStats.home.position ?? '—' }}</td>
            <td class="py-2 text-center">{{ teamStats.home.points ?? '—' }}</td>
            <td class="py-2 text-center">{{ formatGD(teamStats.home.goalDifference) }}</td>
            <td class="py-2 text-center">
              <span v-if="teamStats.home.form" class="inline-flex gap-0.5">
                <span
                  v-for="(result, i) in teamStats.home.form.slice(0, 5)"
                  :key="i"
                  class="w-5 h-5 rounded text-xs flex items-center justify-center font-medium"
                  :class="formClass(result)"
                >
                  {{ result }}
                </span>
              </span>
              <span v-else>—</span>
            </td>
          </tr>
          <tr>
            <td class="py-2 text-gray-900 dark:text-white">{{ awayTeamName }}</td>
            <td class="py-2 text-center font-medium">{{ teamStats.away.position ?? '—' }}</td>
            <td class="py-2 text-center">{{ teamStats.away.points ?? '—' }}</td>
            <td class="py-2 text-center">{{ formatGD(teamStats.away.goalDifference) }}</td>
            <td class="py-2 text-center">
              <span v-if="teamStats.away.form" class="inline-flex gap-0.5">
                <span
                  v-for="(result, i) in teamStats.away.form.slice(0, 5)"
                  :key="i"
                  class="w-5 h-5 rounded text-xs flex items-center justify-center font-medium"
                  :class="formClass(result)"
                >
                  {{ result }}
                </span>
              </span>
              <span v-else>—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- No Data State -->
    <div v-if="!xgStats && !teamStats" class="text-center py-8 text-gray-500 dark:text-gray-400">
      <UIcon name="i-heroicons-chart-bar" class="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p>No statistics available</p>
      <p class="text-xs mt-1">Fetch match data to see statistics</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ScrapedDataItem {
  data_type: string
  data: unknown
}

interface XGData {
  xg?: number
  xga?: number
  xpts?: number
}

interface TeamStatsData {
  position?: number
  points?: number
  goalDifference?: number
  form?: string[]
}

const props = defineProps<{
  scrapedData?: ScrapedDataItem[]
  homeTeamName: string
  awayTeamName: string
}>()

const xgStats = computed(() => {
  if (!props.scrapedData) return null
  const xStats = props.scrapedData.find(d => d.data_type === 'xStats')
  if (!xStats?.data) return null

  const data = xStats.data as {
    homeTeam?: {
      xg?: number
      xga?: number
      xpts?: number
      goalStats?: XGData
      entireSeason?: XGData
    }
    awayTeam?: {
      xg?: number
      xga?: number
      xpts?: number
      goalStats?: XGData
      entireSeason?: XGData
    }
  }

  const home = data.homeTeam
  const away = data.awayTeam
  if (!home && !away) return null

  // Handle both old and new data formats
  const homeXg = home?.xg ?? home?.goalStats?.xg ?? home?.entireSeason?.xg
  const awayXg = away?.xg ?? away?.goalStats?.xg ?? away?.entireSeason?.xg

  if (!homeXg && !awayXg) return null

  return {
    home: {
      xg: homeXg,
      xga: home?.xga ?? home?.goalStats?.xga ?? home?.entireSeason?.xga,
      xpts: home?.xpts ?? home?.goalStats?.xpts ?? home?.entireSeason?.xpts,
    },
    away: {
      xg: awayXg,
      xga: away?.xga ?? away?.goalStats?.xga ?? away?.entireSeason?.xga,
      xpts: away?.xpts ?? away?.goalStats?.xpts ?? away?.entireSeason?.xpts,
    },
  }
})

const teamStats = computed(() => {
  if (!props.scrapedData) return null
  const stats = props.scrapedData.find(d => d.data_type === 'statistics')
  if (!stats?.data) return null

  const data = stats.data as {
    homeTeam?: TeamStatsData
    awayTeam?: TeamStatsData
  }

  const home = data.homeTeam
  const away = data.awayTeam
  if (!home && !away) return null

  // Check if there's any meaningful data
  const hasHome = home?.position || home?.points || home?.form?.length
  const hasAway = away?.position || away?.points || away?.form?.length
  if (!hasHome && !hasAway) return null

  return {
    home: home || {},
    away: away || {},
  }
})

function formatGD(gd: number | undefined): string {
  if (gd === undefined) return '—'
  return gd > 0 ? `+${gd}` : String(gd)
}

function formClass(result: string): string {
  switch (result.toUpperCase()) {
    case 'W':
      return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
    case 'D':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'L':
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
    default:
      return 'bg-gray-100 text-gray-500'
  }
}
</script>
