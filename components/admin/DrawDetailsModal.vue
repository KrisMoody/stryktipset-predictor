<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'sm:max-w-4xl' }">
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-3">
          <h3 class="text-lg font-semibold">Draw #{{ draw?.drawNumber }}</h3>
          <UBadge :color="getGameTypeColor(draw?.gameType)" variant="subtle" size="sm">
            {{ formatGameType(draw?.gameType) }}
          </UBadge>
          <UBadge :color="getStatusColor(draw?.status)" variant="subtle" size="sm">
            {{ draw?.status }}
          </UBadge>
        </div>
      </div>
    </template>

    <template #body>
      <div v-if="draw" class="space-y-6">
        <!-- Draw Metadata -->
        <div
          class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Draw Date</p>
            <p class="font-medium">{{ formatDate(draw.drawDate) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Close Time</p>
            <p class="font-medium">{{ formatDateTime(draw.closeTime) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Matches</p>
            <p class="font-medium">{{ draw.matchesWithResults }}/{{ draw.totalMatches }} results</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Current</p>
            <UBadge :color="draw.isCurrent ? 'success' : 'neutral'" variant="subtle" size="sm">
              {{ draw.isCurrent ? 'Yes' : 'No' }}
            </UBadge>
          </div>
        </div>

        <!-- Matches Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead
              class="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"
            >
              <tr>
                <th class="py-2 px-2 text-left w-8">#</th>
                <th class="py-2 px-2 text-left">Match</th>
                <th class="py-2 px-2 text-left">League</th>
                <th class="py-2 px-2 text-center">Odds (1/X/2)</th>
                <th class="py-2 px-2 text-center">Sv Folket</th>
                <th class="py-2 px-2 text-center">Result</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="match in draw.matches"
                :key="match.id"
                class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td class="py-2 px-2 font-medium text-gray-500">{{ match.matchNumber }}</td>
                <td class="py-2 px-2">
                  <div class="flex flex-col">
                    <span class="font-medium">{{ match.homeTeam?.name || 'Unknown' }}</span>
                    <span class="text-gray-500 dark:text-gray-400">{{
                      match.awayTeam?.name || 'Unknown'
                    }}</span>
                  </div>
                </td>
                <td class="py-2 px-2">
                  <span class="text-gray-600 dark:text-gray-400">
                    {{ match.league?.name || 'Unknown' }}
                  </span>
                </td>
                <td class="py-2 px-2">
                  <div v-if="match.odds?.current" class="flex justify-center gap-1 text-xs">
                    <span class="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                      {{ formatOdds(match.odds.current.home) }}
                    </span>
                    <span class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                      {{ formatOdds(match.odds.current.draw) }}
                    </span>
                    <span class="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 rounded">
                      {{ formatOdds(match.odds.current.away) }}
                    </span>
                  </div>
                  <span v-else class="text-gray-400">-</span>
                </td>
                <td class="py-2 px-2">
                  <div v-if="match.svenskaFolket?.home" class="flex justify-center gap-1 text-xs">
                    <span class="text-blue-600 dark:text-blue-400"
                      >{{ match.svenskaFolket.home }}%</span
                    >
                    <span class="text-gray-500">/</span>
                    <span class="text-gray-600 dark:text-gray-400"
                      >{{ match.svenskaFolket.draw }}%</span
                    >
                    <span class="text-gray-500">/</span>
                    <span class="text-red-600 dark:text-red-400"
                      >{{ match.svenskaFolket.away }}%</span
                    >
                  </div>
                  <span v-else class="text-gray-400 text-center block">-</span>
                </td>
                <td class="py-2 px-2">
                  <div v-if="match.result.outcome" class="flex items-center justify-center gap-2">
                    <span class="text-gray-600 dark:text-gray-400">
                      {{ match.result.home }} - {{ match.result.away }}
                    </span>
                    <UBadge
                      :color="getOutcomeColor(match.result.outcome)"
                      variant="solid"
                      size="xs"
                    >
                      {{ match.result.outcome }}
                    </UBadge>
                  </div>
                  <span v-else class="text-gray-400 text-center block">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- No matches message -->
        <div v-if="!draw.matches?.length" class="text-center py-8 text-gray-500">
          No matches found for this draw
        </div>
      </div>

      <!-- Loading state -->
      <div v-else class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <div class="flex gap-2">
          <UButton
            v-if="draw"
            variant="soft"
            color="primary"
            icon="i-heroicons-arrow-path"
            :loading="refreshing"
            @click="$emit('refresh')"
          >
            Refresh from API
          </UButton>
          <UButton
            v-if="draw"
            variant="soft"
            icon="i-heroicons-arrow-top-right-on-square"
            :to="`/draw/${draw.id}`"
            target="_blank"
          >
            View on Site
          </UButton>
        </div>
        <UButton variant="ghost" @click="isOpen = false"> Close </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface DrawMatch {
  id: number
  matchNumber: number
  matchId: string | null
  startTime: string
  status: string
  homeTeam: { id: number; name: string; short_name: string | null } | null
  awayTeam: { id: number; name: string; short_name: string | null } | null
  league: { id: number; name: string; country: { name: string } | null } | null
  result: {
    home: number | null
    away: number | null
    outcome: string | null
  }
  odds: {
    current: { home: number; draw: number; away: number } | null
    start: { home: number; draw: number; away: number } | null
  }
  svenskaFolket: {
    home: string | null
    draw: string | null
    away: string | null
  } | null
  expertTips: {
    home: string | null
    draw: string | null
    away: string | null
  } | null
  prediction: {
    home: number | null
    draw: number | null
    away: number | null
    recommended: string | null
    confidence: number | null
  } | null
}

interface DrawDetails {
  id: number
  drawNumber: number
  gameType: string
  drawDate: string
  closeTime: string
  status: string
  isCurrent: boolean
  netSale: string | null
  totalMatches: number
  matchesWithResults: number
  matches: DrawMatch[]
}

defineProps<{
  draw: DrawDetails | null
  refreshing?: boolean
}>()

defineEmits<{
  refresh: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })

function formatDate(date: string | null): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('sv-SE')
}

function formatDateTime(date: string | null): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleString('sv-SE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatOdds(odds: number | null): string {
  if (odds === null || odds === undefined) return '-'
  return odds.toFixed(2)
}

function formatGameType(gameType: string | undefined): string {
  if (!gameType) return ''
  return gameType.charAt(0).toUpperCase() + gameType.slice(1)
}

function getGameTypeColor(gameType: string | undefined): 'primary' | 'info' | 'warning' {
  switch (gameType) {
    case 'stryktipset':
      return 'primary'
    case 'europatipset':
      return 'info'
    case 'topptipset':
      return 'warning'
    default:
      return 'primary'
  }
}

function getStatusColor(status: string | undefined): 'success' | 'warning' | 'neutral' {
  switch (status) {
    case 'Open':
      return 'success'
    case 'Closed':
      return 'warning'
    case 'Completed':
    default:
      return 'neutral'
  }
}

function getOutcomeColor(outcome: string | null): 'primary' | 'neutral' | 'error' {
  switch (outcome) {
    case '1':
      return 'primary'
    case 'X':
      return 'neutral'
    case '2':
      return 'error'
    default:
      return 'neutral'
  }
}
</script>
