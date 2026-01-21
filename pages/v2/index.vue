<template>
  <div class="p-6">
    <!-- Quick Stats -->
    <V2QuickStats :stats="quickStats" class="mb-6" />

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ gameDisplayName }} Dashboard
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          AI-powered predictions for Swedish {{ gameDisplayName }}
        </p>
      </div>
      <UButton
        icon="i-heroicons-arrow-path"
        :loading="syncing"
        :disabled="!isActionAllowed"
        @click="syncDraws"
      >
        Sync
      </UButton>
    </div>

    <!-- Schedule Status Banner -->
    <UAlert
      v-if="scheduleStatus && !scheduleStatus.isActive"
      color="warning"
      icon="i-heroicons-clock"
      class="mb-6"
    >
      <template #title>Outside Betting Window</template>
      <template #description>
        <p class="text-sm">{{ scheduleStatus.reason }}</p>
        <div class="flex items-center gap-3 mt-2">
          <USwitch id="admin-override" v-model="adminOverride" size="sm" />
          <label for="admin-override" class="text-sm cursor-pointer"> Admin override </label>
        </div>
      </template>
    </UAlert>

    <!-- Loading State -->
    <div v-if="pending" class="flex justify-center py-12">
      <div class="text-center">
        <div
          class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto mb-3"
        />
        <p class="text-gray-500 dark:text-gray-400">Loading draws...</p>
      </div>
    </div>

    <!-- Error State -->
    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Error Loading Draws"
      :description="error.message"
      class="mb-6"
    />

    <!-- Draws Grid -->
    <div v-else-if="draws && draws.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <V2DrawCard
        v-for="draw in draws"
        :key="draw.id"
        :draw="draw"
        :generating="generatingPredictions[draw.draw_number]"
        :can-generate="isActionAllowed"
        @generate="generatePredictions(draw.draw_number)"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12">
      <UIcon name="i-heroicons-inbox" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Active Draws</h2>
      <p class="text-gray-500 dark:text-gray-400 mb-4">
        There are no active {{ gameDisplayName }} draws at the moment.
      </p>
      <UButton :loading="syncing" :disabled="!isActionAllowed" @click="syncDraws">
        Sync Draws
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ScheduleWindowStatus } from '~/types'
import type { GameType } from '~/types/game-types'
import { getGameConfig } from '~/server/constants/game-configs'

definePageMeta({
  layout: 'v2',
})

const route = useRoute()
const toast = useToast()

// Game type from URL query (controlled by header dropdown)
const gameType = computed(() => (route.query.gameType as GameType) || 'stryktipset')
const gameDisplayName = computed(() => getGameConfig(gameType.value).displayName)

useHead({
  title: computed(() => `${gameDisplayName.value} Dashboard - V2`),
})

// Schedule window states
const scheduleStatus = ref<ScheduleWindowStatus | null>(null)
const adminOverride = ref(false)

const isActionAllowed = computed(() => {
  if (!scheduleStatus.value) return false
  return scheduleStatus.value.isActive || adminOverride.value
})

const syncing = ref(false)
const generatingPredictions = ref<Record<number, boolean>>({})

// Load schedule status
async function loadScheduleStatus() {
  try {
    const result = await $fetch<{ success: boolean; status?: ScheduleWindowStatus }>(
      '/api/schedule/status',
      { query: { gameType: gameType.value } }
    )
    if (result.success && result.status) {
      scheduleStatus.value = result.status
    }
  } catch (err) {
    console.error('Error loading schedule status:', err)
  }
}

watch(gameType, () => loadScheduleStatus())
onMounted(async () => {
  await loadScheduleStatus()
  setInterval(loadScheduleStatus, 60000)
})

interface MatchData {
  id: number
  predictions?: { id: number }[]
}

interface DrawData {
  id: number
  draw_number: number
  draw_date: string
  close_time: string
  status: string
  net_sale?: string | number
  game_type: string
  matches?: MatchData[]
}

// Fetch current draws
const {
  data: response,
  pending,
  error,
  refresh,
} = await useFetch<{
  success: boolean
  gameType?: GameType
  draws?: DrawData[]
}>('/api/draws/current', {
  query: { gameType: gameType },
  watch: [gameType],
})

const draws = computed(() => response.value?.draws || [])

// Quick stats computation
const quickStats = computed(() => {
  const activeDraws = draws.value.length
  let pendingPredictions = 0
  let nextClose: Date | null = null

  for (const draw of draws.value) {
    if (draw.matches) {
      pendingPredictions += draw.matches.filter(
        m => !m.predictions || m.predictions.length === 0
      ).length
    }
    const closeTime = new Date(draw.close_time)
    if (!nextClose || closeTime < nextClose) {
      nextClose = closeTime
    }
  }

  return {
    activeDraws,
    pendingPredictions,
    valueOpportunities: 0, // TODO: Calculate from match calculations
    nextCloseTime: nextClose
      ? nextClose.toLocaleString('sv-SE', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
  }
})

async function syncDraws() {
  syncing.value = true
  try {
    await $fetch('/api/admin/sync', {
      method: 'POST',
      query: { gameType: gameType.value },
    })
    await refresh()
    await loadScheduleStatus()
    toast.add({
      title: 'Sync Complete',
      description: `${gameDisplayName.value} draws synced successfully`,
      color: 'success',
    })
  } catch (err) {
    console.error('Error syncing draws:', err)
    toast.add({
      title: 'Sync Failed',
      description: err instanceof Error ? err.message : 'Failed to sync draws',
      color: 'error',
    })
  } finally {
    syncing.value = false
  }
}

function generatePredictions(drawNumber: number) {
  const draw = draws.value.find(d => d.draw_number === drawNumber)
  if (!draw || !draw.matches) return

  generatingPredictions.value[drawNumber] = true
  const matchCount = draw.matches.length

  toast.add({
    title: 'Generating Predictions',
    description: `Processing ${matchCount} matches for draw ${drawNumber}...`,
    color: 'info',
  })

  const predictions = draw.matches.map(match =>
    $fetch(`/api/matches/${match.id}/predict`, {
      method: 'POST',
      body: { gameType: gameType.value },
    }).catch(err => {
      console.error(`Error predicting match ${match.id}:`, err)
      return null
    })
  )

  Promise.all(predictions).then(async results => {
    const successCount = results.filter(r => r !== null).length
    const failCount = results.length - successCount

    await refresh()
    generatingPredictions.value[drawNumber] = false

    if (failCount === 0) {
      toast.add({
        title: 'Predictions Complete',
        description: `Generated ${successCount} predictions for draw ${drawNumber}`,
        color: 'success',
      })
    } else {
      toast.add({
        title: 'Predictions Partially Complete',
        description: `${successCount} succeeded, ${failCount} failed for draw ${drawNumber}`,
        color: 'warning',
      })
    }
  })
}
</script>
