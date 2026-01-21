<template>
  <div class="space-y-4">
    <!-- Summary -->
    <div v-if="summary" class="grid grid-cols-3 gap-4 text-center">
      <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ summary.homeWins }}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ homeTeamName }} wins</div>
      </div>
      <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ summary.draws }}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400">Draws</div>
      </div>
      <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ summary.awayWins }}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ awayTeamName }} wins</div>
      </div>
    </div>

    <!-- Match List -->
    <div v-if="matches.length > 0">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Recent Meetings</h4>
      <div class="space-y-2">
        <div
          v-for="(match, index) in matches"
          :key="index"
          class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <div class="flex items-center gap-3">
            <span class="text-xs text-gray-500 dark:text-gray-400 w-20">
              {{ formatDate(match.date) }}
            </span>
            <span class="text-sm text-gray-900 dark:text-white">
              {{ match.homeTeam }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="font-bold text-gray-900 dark:text-white px-2 py-1 bg-white dark:bg-gray-700 rounded"
            >
              {{ match.homeGoals }} - {{ match.awayGoals }}
            </span>
          </div>
          <div class="text-sm text-gray-900 dark:text-white text-right">
            {{ match.awayTeam }}
          </div>
        </div>
      </div>
    </div>

    <!-- No Data State -->
    <div v-if="matches.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
      <UIcon name="i-heroicons-users" class="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p>No head-to-head data available</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface H2HMatch {
  date?: string
  homeTeam?: string
  awayTeam?: string
  homeGoals?: number
  awayGoals?: number
  home_team?: string
  away_team?: string
  home_goals?: number
  away_goals?: number
  result?: string
}

interface ScrapedDataItem {
  data_type: string
  data: unknown
}

const props = defineProps<{
  scrapedData?: ScrapedDataItem[]
  homeTeamName: string
  awayTeamName: string
}>()

const h2hData = computed(() => {
  if (!props.scrapedData) return null
  const h2h = props.scrapedData.find(d => d.data_type === 'headToHead')
  return h2h?.data as { matches?: H2HMatch[] } | null
})

const matches = computed(() => {
  if (!h2hData.value?.matches) return []
  return h2hData.value.matches.slice(0, 5).map(m => ({
    date: m.date || '',
    homeTeam: m.homeTeam || m.home_team || 'Unknown',
    awayTeam: m.awayTeam || m.away_team || 'Unknown',
    homeGoals: m.homeGoals ?? m.home_goals ?? 0,
    awayGoals: m.awayGoals ?? m.away_goals ?? 0,
  }))
})

const summary = computed(() => {
  if (matches.value.length === 0) return null

  let homeWins = 0
  let awayWins = 0
  let draws = 0

  for (const match of matches.value) {
    // Normalize to check if the current homeTeam is home or away in each match
    const homeTeamFirstWord = props.homeTeamName.toLowerCase().split(' ')[0] || ''
    const isHomeTeamHome = match.homeTeam.toLowerCase().includes(homeTeamFirstWord)

    if (match.homeGoals > match.awayGoals) {
      if (isHomeTeamHome) homeWins++
      else awayWins++
    } else if (match.homeGoals < match.awayGoals) {
      if (isHomeTeamHome) awayWins++
      else homeWins++
    } else {
      draws++
    }
  }

  return { homeWins, awayWins, draws }
})

function formatDate(date: string): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('sv-SE', {
      year: '2-digit',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return date
  }
}
</script>
