<template>
  <div class="space-y-4">
    <!-- Summary Section -->
    <div
      v-if="h2hData?.summary"
      class="grid grid-cols-3 gap-2 text-center"
    >
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
        <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {{ h2hData.summary.homeWins }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ homeTeamName }} Wins
        </p>
      </div>
      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
        <p class="text-2xl font-bold text-gray-600 dark:text-gray-400">
          {{ h2hData.summary.draws }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Draws
        </p>
      </div>
      <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
        <p class="text-2xl font-bold text-red-600 dark:text-red-400">
          {{ h2hData.summary.awayWins }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ awayTeamName }} Wins
        </p>
      </div>
    </div>

    <!-- Visual Bar -->
    <div
      v-if="h2hData?.summary && h2hData.summary.totalMatches > 0"
      class="h-3 rounded-full overflow-hidden flex"
    >
      <div
        :style="{ width: `${homeWinPercent}%` }"
        class="bg-blue-500 transition-all duration-300"
      />
      <div
        :style="{ width: `${drawPercent}%` }"
        class="bg-gray-400 transition-all duration-300"
      />
      <div
        :style="{ width: `${awayWinPercent}%` }"
        class="bg-red-500 transition-all duration-300"
      />
    </div>

    <!-- Matches Table -->
    <div v-if="h2hData?.matches && h2hData.matches.length > 0">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Previous Meetings
      </h4>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                Date
              </th>
              <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                Match
              </th>
              <th class="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">
                Score
              </th>
              <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">
                Competition
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr
              v-for="(match, idx) in displayedMatches"
              :key="idx"
              class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <td class="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ formatDate(match.date) }}
              </td>
              <td class="px-3 py-2">
                <span :class="isHomeTeam(match.homeTeam) ? 'font-semibold text-blue-600 dark:text-blue-400' : ''">
                  {{ match.homeTeam }}
                </span>
                <span class="text-gray-500 dark:text-gray-400 mx-1">vs</span>
                <span :class="isAwayTeam(match.awayTeam) ? 'font-semibold text-red-600 dark:text-red-400' : ''">
                  {{ match.awayTeam }}
                </span>
              </td>
              <td class="px-3 py-2 text-center">
                <UBadge
                  :color="getScoreColor(match)"
                  variant="soft"
                  size="sm"
                >
                  {{ match.score }}
                </UBadge>
              </td>
              <td class="px-3 py-2 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                {{ match.competition || '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Show More Button -->
      <div
        v-if="h2hData.matches.length > 5"
        class="mt-3 text-center"
      >
        <UButton
          variant="ghost"
          size="sm"
          @click="showAll = !showAll"
        >
          {{ showAll ? 'Show Less' : `Show All (${h2hData.matches.length})` }}
        </UButton>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="!h2hData || !h2hData.matches || h2hData.matches.length === 0"
      class="text-center py-6 text-gray-500 dark:text-gray-400"
    >
      <UIcon
        name="i-heroicons-users"
        class="w-8 h-8 mx-auto mb-2 opacity-50"
      />
      <p class="text-sm">
        No head-to-head data available.
      </p>
      <p class="text-xs mt-1">
        Try scraping the match to fetch historical matchups.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HeadToHeadData, HeadToHeadMatch } from '~/types'

const props = defineProps<{
  scrapedData: Array<{ data_type: string, data: any }> | null | undefined
  homeTeamName: string
  awayTeamName: string
}>()

const showAll = ref(false)

// Extract H2H data
const h2hData = computed((): HeadToHeadData | null => {
  if (!props.scrapedData) return null
  const h2h = props.scrapedData.find(d => d.data_type === 'headToHead')
  return h2h?.data || null
})

// Calculate percentages for visual bar
const homeWinPercent = computed(() => {
  if (!h2hData.value?.summary?.totalMatches) return 0
  return (h2hData.value.summary.homeWins / h2hData.value.summary.totalMatches) * 100
})

const drawPercent = computed(() => {
  if (!h2hData.value?.summary?.totalMatches) return 0
  return (h2hData.value.summary.draws / h2hData.value.summary.totalMatches) * 100
})

const awayWinPercent = computed(() => {
  if (!h2hData.value?.summary?.totalMatches) return 0
  return (h2hData.value.summary.awayWins / h2hData.value.summary.totalMatches) * 100
})

// Displayed matches (limit to 5 unless showAll)
const displayedMatches = computed(() => {
  if (!h2hData.value?.matches) return []
  return showAll.value ? h2hData.value.matches : h2hData.value.matches.slice(0, 5)
})

// Check if team name matches home team
const isHomeTeam = (teamName: string | undefined) => {
  if (!teamName) return false
  return teamName.toLowerCase().includes(props.homeTeamName.toLowerCase())
    || props.homeTeamName.toLowerCase().includes(teamName.toLowerCase())
}

// Check if team name matches away team
const isAwayTeam = (teamName: string | undefined) => {
  if (!teamName) return false
  return teamName.toLowerCase().includes(props.awayTeamName.toLowerCase())
    || props.awayTeamName.toLowerCase().includes(teamName.toLowerCase())
}

// Format date
const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
  catch {
    return dateStr
  }
}

// Get color based on score result
const getScoreColor = (match: HeadToHeadMatch) => {
  if (!match.score) return 'neutral'
  const parts = match.score.split('-')
  if (parts.length !== 2) return 'neutral'

  const home = parseInt(parts[0] || '0')
  const away = parseInt(parts[1] || '0')

  if (isNaN(home) || isNaN(away)) return 'neutral'

  // Color based on which team in current match won
  if (home > away) {
    return isHomeTeam(match.homeTeam) ? 'success' : 'error'
  }
  else if (away > home) {
    return isAwayTeam(match.awayTeam) ? 'success' : 'error'
  }
  return 'warning' // Draw
}
</script>
