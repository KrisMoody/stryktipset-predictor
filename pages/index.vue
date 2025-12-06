<template>
  <UContainer class="py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2">Stryktipset AI Predictor</h1>
      <p class="text-gray-600 dark:text-gray-400">AI-powered predictions for Swedish Stryktipset</p>
    </div>

    <!-- Schedule Window Status Banner -->
    <UAlert
      v-if="scheduleStatus"
      :color="scheduleStatus.isActive ? 'success' : 'warning'"
      :icon="scheduleStatus.isActive ? 'i-heroicons-check-circle' : 'i-heroicons-clock'"
      class="mb-6"
    >
      <template #title>
        {{ scheduleStatus.isActive ? 'Active Betting Window' : 'Outside Betting Window' }}
      </template>
      <template #description>
        <p class="text-sm">
          {{ scheduleStatus.reason }}
        </p>
        <p
          v-if="scheduleStatus.isActive && scheduleStatus.minutesUntilClose"
          class="text-xs mt-1 opacity-80"
        >
          Spelstopp in {{ formatDuration(scheduleStatus.minutesUntilClose) }}
        </p>
        <p
          v-if="!scheduleStatus.isActive && scheduleStatus.minutesUntilOpen"
          class="text-xs mt-1 opacity-80"
        >
          Window opens in {{ formatDuration(scheduleStatus.minutesUntilOpen) }}
        </p>
      </template>
    </UAlert>

    <!-- Admin Override Toggle (only shown outside window) -->
    <div
      v-if="scheduleStatus && !scheduleStatus.isActive"
      class="flex items-center gap-3 mb-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
    >
      <USwitch
        id="admin-override-index"
        v-model="adminOverride"
        aria-describedby="admin-override-index-desc"
      />
      <label
        id="admin-override-index-desc"
        for="admin-override-index"
        class="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
      >
        Admin Override (enable actions outside betting window)
      </label>
    </div>

    <!-- Actions -->
    <div class="mb-6">
      <UTooltip
        :text="
          !isActionAllowed
            ? 'Disabled outside betting window. Enable admin override to proceed.'
            : 'Sync draws from Svenska Spel'
        "
      >
        <UButton
          icon="i-heroicons-arrow-path"
          :loading="syncing"
          :disabled="!isActionAllowed"
          @click="syncDraws"
        >
          Sync Draws
        </UButton>
      </UTooltip>
    </div>

    <!-- Loading State -->
    <div
      v-if="pending"
      class="flex justify-center py-12"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="text-center">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"
          aria-hidden="true"
        />
        <p class="text-gray-600 dark:text-gray-400">Laddar omgångar...</p>
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
      role="alert"
    />

    <!-- Draws List -->
    <div v-else-if="draws && draws.length > 0" class="space-y-6">
      <UCard v-for="draw in draws" :key="draw.id">
        <template #header>
          <div class="flex justify-between items-start">
            <div>
              <h2 class="text-2xl font-semibold">Draw #{{ draw.draw_number }}</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{ formatDate(draw.draw_date) }} • Closes: {{ formatDateTime(draw.close_time) }}
              </p>
            </div>
            <UBadge :color="getStatusColor(draw.status)" variant="subtle" size="lg">
              {{ draw.status }}
            </UBadge>
          </div>
        </template>

        <!-- Match Stats -->
        <div class="mb-4">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p class="text-gray-600 dark:text-gray-400">Matches</p>
              <p class="text-lg font-semibold">
                {{ draw.matches?.length || 0 }}
              </p>
            </div>
            <div>
              <p class="text-gray-600 dark:text-gray-400">With Predictions</p>
              <p class="text-lg font-semibold">
                {{ countMatchesWithPredictions(draw) }}
              </p>
            </div>
            <div>
              <p class="text-gray-600 dark:text-gray-400">Net Sale</p>
              <p class="text-lg font-semibold">
                {{ formatCurrency(draw.net_sale) }}
              </p>
            </div>
            <div>
              <p class="text-gray-600 dark:text-gray-400">Ready</p>
              <UIcon
                :name="isDrawReady(draw) ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
                :class="isDrawReady(draw) ? 'text-green-500' : 'text-gray-400'"
                class="w-6 h-6"
              />
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex gap-2">
            <UButton :to="`/draw/${draw.draw_number}`" color="primary"> View Matches </UButton>
            <UTooltip
              :text="
                !isActionAllowed
                  ? 'Disabled outside betting window'
                  : 'Generate AI predictions for all matches'
              "
            >
              <UButton
                color="success"
                :disabled="!draw.matches || draw.matches.length === 0 || !isActionAllowed"
                :loading="generatingPredictions[draw.draw_number]"
                @click="generatePredictions(draw.draw_number)"
              >
                Generate Predictions
              </UButton>
            </UTooltip>
            <UTooltip
              :text="
                !isActionAllowed
                  ? 'Disabled outside betting window'
                  : !isDrawReady(draw)
                    ? 'All matches need predictions first'
                    : 'Generate optimal coupon'
              "
            >
              <UButton
                :to="`/draw/${draw.draw_number}/optimize`"
                color="primary"
                :disabled="!isDrawReady(draw) || !isActionAllowed"
              >
                Optimize Coupon
              </UButton>
            </UTooltip>
          </div>
        </template>
      </UCard>
    </div>

    <!-- Empty State -->
    <UCard v-else>
      <div class="text-center py-12">
        <UIcon name="i-heroicons-inbox" class="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h2 class="text-lg font-semibold mb-2">No Active Draws</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          There are no active Stryktipset draws at the moment.
        </p>
        <UTooltip
          :text="
            !isActionAllowed ? 'Disabled outside betting window' : 'Sync draws from Svenska Spel'
          "
        >
          <UButton :loading="syncing" :disabled="!isActionAllowed" @click="syncDraws">
            Sync Draws
          </UButton>
        </UTooltip>
      </div>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
import type { ScheduleWindowStatus } from '~/types'

useHead({
  title: 'Stryktipset AI Predictor - Dashboard',
})

// Schedule window states
const scheduleStatus = ref<ScheduleWindowStatus | null>(null)
const adminOverride = ref(false)

// Computed property for action buttons
const isActionAllowed = computed(() => {
  if (!scheduleStatus.value) return true // Allow if status not loaded yet
  return scheduleStatus.value.isActive || adminOverride.value
})

const syncing = ref(false)
const generatingPredictions = ref<Record<number, boolean>>({})

// Load schedule status
async function loadScheduleStatus() {
  try {
    const result = await $fetch<{ success: boolean; status?: ScheduleWindowStatus }>(
      '/api/schedule/status'
    )
    if (result.success && result.status) {
      scheduleStatus.value = result.status
    }
  } catch (error) {
    console.error('Error loading schedule status:', error)
  }
}

// Load schedule status on mount and refresh every minute
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
  draws?: DrawData[]
  error?: string
}>('/api/draws/current')

const draws = computed(() => response.value?.draws || [])

// Sync draws
const syncDraws = async () => {
  syncing.value = true
  try {
    await $fetch('/api/admin/sync', { method: 'POST' })
    await refresh()
  } catch (err) {
    console.error('Error syncing draws:', err)
  } finally {
    syncing.value = false
  }
}

// Generate predictions for all matches in a draw
const generatePredictions = async (drawNumber: number) => {
  generatingPredictions.value[drawNumber] = true
  try {
    const draw = draws.value.find(d => d.draw_number === drawNumber)
    if (!draw || !draw.matches) return

    for (const match of draw.matches) {
      try {
        await $fetch(`/api/matches/${match.id}/predict`, { method: 'POST' })
      } catch (err) {
        console.error(`Error predicting match ${match.id}:`, err)
      }
    }

    await refresh()
  } finally {
    generatingPredictions.value[drawNumber] = false
  }
}

// Helper functions
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatDateTime = (datetime: string) => {
  return new Date(datetime).toLocaleString('sv-SE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatCurrency = (amount: string | number | undefined) => {
  if (!amount) return 'N/A'
  return `${parseFloat(String(amount)).toLocaleString('sv-SE')} SEK`
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Open':
      return 'success'
    case 'Closed':
      return 'warning'
    case 'Completed':
      return 'neutral'
    default:
      return 'neutral'
  }
}

const countMatchesWithPredictions = (draw: DrawData) => {
  if (!draw.matches) return 0
  return draw.matches.filter(m => m.predictions && m.predictions.length > 0).length
}

const isDrawReady = (draw: DrawData) => {
  if (!draw.matches || draw.matches.length !== 13) return false
  return draw.matches.every(m => m.predictions && m.predictions.length > 0)
}

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}
</script>
