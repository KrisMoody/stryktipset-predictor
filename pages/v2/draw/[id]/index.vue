<template>
  <div class="p-6">
    <!-- Breadcrumb -->
    <V2AppBreadcrumb />

    <!-- Loading State -->
    <div v-if="pending" class="flex justify-center py-12">
      <div class="text-center">
        <div
          class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto mb-3"
        />
        <p class="text-gray-500 dark:text-gray-400">Loading draw...</p>
      </div>
    </div>

    <template v-else-if="draw">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              Draw #{{ draw.draw_number }}
            </h1>
            <UBadge :color="statusColor" variant="subtle" size="lg">
              {{ draw.status }}
            </UBadge>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ formatDate(draw.draw_date) }} • Closes: {{ formatDateTime(draw.close_time) }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="hasAnyPredictions"
            color="warning"
            variant="soft"
            size="sm"
            :disabled="!isActionAllowed"
            @click="reEvaluateAllModal = true"
          >
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-1" />
            Re-evaluate All
          </UButton>
          <UButton
            :to="{ path: `/v2/draw/${drawId}/optimize`, query: { gameType } }"
            color="primary"
            :disabled="!isDrawReady || !isActionAllowed"
          >
            Optimize Coupon
          </UButton>
        </div>
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
            <USwitch id="admin-override-draw" v-model="adminOverride" size="sm" />
            <label for="admin-override-draw" class="text-sm cursor-pointer">Admin override</label>
          </div>
        </template>
      </UAlert>

      <!-- Matches List -->
      <div class="space-y-4">
        <V2MatchCard
          v-for="match in draw.matches"
          :key="match.id"
          :match="match"
          :predicting="predicting[match.id]"
          :can-predict="isActionAllowed"
          @predict="predictMatch(match.id)"
          @reevaluate="openReEvaluationModal(match)"
        />
      </div>

      <!-- Footer Actions -->
      <div class="mt-8 flex gap-4">
        <UButton
          v-if="hasAnyPredictions"
          color="warning"
          variant="soft"
          size="lg"
          :disabled="!isActionAllowed"
          @click="reEvaluateAllModal = true"
        >
          <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 mr-2" />
          Re-evaluate All Matches
        </UButton>
        <UButton
          :to="{ path: `/v2/draw/${drawId}/optimize`, query: { gameType } }"
          color="primary"
          size="lg"
          :disabled="!isDrawReady || !isActionAllowed"
        >
          Generate Optimal Coupon
        </UButton>
      </div>
    </template>

    <!-- Re-evaluation Modal -->
    <MatchReEvaluationModal
      :model-value="reEvaluationModal.isOpen"
      :match-id="reEvaluationModal.matchId"
      :home-team="reEvaluationModal.homeTeam"
      :away-team="reEvaluationModal.awayTeam"
      :current-prediction="reEvaluationModal.currentPrediction"
      @update:model-value="reEvaluationModal.isOpen = $event"
      @reevaluated="handleReEvaluated"
    />

    <!-- Re-evaluate All Modal -->
    <MatchReEvaluateAllModal
      :model-value="reEvaluateAllModal"
      :draw-number="Number(drawId)"
      :game-type="gameType"
      @update:model-value="reEvaluateAllModal = $event"
      @confirmed="handleReEvaluateAllConfirmed"
    />
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
const drawId = route.params.id as string
const toast = useToast()

const gameType = computed(() => (route.query.gameType as GameType) || 'stryktipset')
const gameDisplayName = computed(() => getGameConfig(gameType.value).displayName)

useHead({
  title: computed(() => `Draw #${drawId} - ${gameDisplayName.value} V2`),
})

// Schedule window states
const scheduleStatus = ref<ScheduleWindowStatus | null>(null)
const adminOverride = ref(false)

const isActionAllowed = computed(() => {
  if (!scheduleStatus.value) return false
  return scheduleStatus.value.isActive || adminOverride.value
})

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

onMounted(async () => {
  await loadScheduleStatus()
  setInterval(loadScheduleStatus, 60000)
})

watch(gameType, () => loadScheduleStatus())

const predicting = ref<Record<number, boolean>>({})

// Re-evaluation modal states
interface CurrentPrediction {
  predicted_outcome: string
  confidence: string
  probability_home: number
  probability_draw: number
  probability_away: number
}

const reEvaluationModal = ref({
  isOpen: false,
  matchId: 0,
  homeTeam: '',
  awayTeam: '',
  currentPrediction: null as CurrentPrediction | null,
})
const reEvaluateAllModal = ref(false)

interface MatchPrediction {
  predicted_outcome: string
  confidence: string
  probability_home: number | string
  probability_draw: number | string
  probability_away: number | string
  is_spik_suitable?: boolean
  is_reevaluation?: boolean
  reasoning?: string
  key_factors?: string[] | string
  similar_matches?: unknown[]
}

interface Match {
  id: number
  match_number: number
  homeTeam: { id: number; name: string; short_name?: string }
  awayTeam: { id: number; name: string; short_name?: string }
  league: { name: string; country?: { name: string } }
  start_time: string
  predictions?: MatchPrediction[]
  match_odds?: {
    type?: string
    home_odds: string | number
    draw_odds: string | number
    away_odds: string | number
  }[]
  match_scraped_data?: { data_type: string; data: unknown }[]
}

interface Draw {
  draw_number: number
  draw_date: string
  close_time: string
  status: string
  is_current: boolean
  matches?: Match[]
}

const {
  data: response,
  pending,
  refresh,
} = await useFetch<{ success: boolean; draw?: Draw }>(`/api/draws/${drawId}`, {
  query: { gameType },
  watch: [gameType],
})

const draw = computed(() => response.value?.draw)

const statusColor = computed(() => {
  switch (draw.value?.status) {
    case 'Open':
      return 'success'
    case 'Closed':
      return 'warning'
    case 'Completed':
      return 'neutral'
    default:
      return 'neutral'
  }
})

const hasAnyPredictions = computed(() => {
  if (!draw.value?.matches) return false
  return draw.value.matches.some(m => m.predictions && m.predictions.length > 0)
})

const isDrawReady = computed(() => {
  const expectedMatchCount = getGameConfig(gameType.value).matchCount
  if (!draw.value?.matches || draw.value.matches.length !== expectedMatchCount) return false
  return draw.value.matches.every(m => m.predictions && m.predictions.length > 0)
})

async function predictMatch(matchId: number) {
  predicting.value[matchId] = true
  try {
    await $fetch(`/api/matches/${matchId}/predict`, {
      method: 'POST',
      body: { gameType: gameType.value },
    })
    await refresh()
    toast.add({
      title: 'Prediction Generated',
      description: `Match predicted successfully`,
      color: 'success',
    })
  } catch (err) {
    console.error('Error predicting match:', err)
    toast.add({
      title: 'Prediction Failed',
      description: err instanceof Error ? err.message : 'Failed to predict match',
      color: 'error',
    })
  } finally {
    predicting.value[matchId] = false
  }
}

// Map MatchPrediction to CurrentPrediction for the modal
function mapToCurrentPrediction(pred: MatchPrediction | undefined): CurrentPrediction | null {
  if (!pred) return null
  return {
    predicted_outcome: pred.predicted_outcome,
    confidence: pred.confidence,
    probability_home: Number(pred.probability_home),
    probability_draw: Number(pred.probability_draw),
    probability_away: Number(pred.probability_away),
  }
}

function openReEvaluationModal(match: Match) {
  reEvaluationModal.value = {
    isOpen: true,
    matchId: match.id,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    currentPrediction: mapToCurrentPrediction(match.predictions?.[0]),
  }
}

async function handleReEvaluated() {
  await refresh()
}

async function handleReEvaluateAllConfirmed() {
  await refresh()
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateTime(datetime: string) {
  return new Date(datetime).toLocaleString('sv-SE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
