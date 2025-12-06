<template>
  <div>
    <UContainer class="py-8">
      <AppBreadcrumb />

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
          <p class="text-gray-600 dark:text-gray-400">Laddar omgång...</p>
        </div>
      </div>

      <div v-else-if="draw">
        <!-- Header -->
        <div class="mb-8">
          <div class="flex justify-between items-start">
            <div>
              <h1 class="text-4xl font-bold mb-2">Draw #{{ draw.draw_number }}</h1>
              <p class="text-gray-600 dark:text-gray-400">
                {{ formatDate(draw.draw_date) }} • Closes: {{ formatDateTime(draw.close_time) }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <UButton
                v-if="hasAnyPredictions(draw)"
                size="sm"
                color="warning"
                variant="soft"
                :loading="reEvaluatingAll"
                :disabled="!isActionAllowed"
                @click="reEvaluateAllModal = true"
              >
                <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-1" />
                Re-evaluate All
              </UButton>
              <UBadge :color="getStatusColor(draw.status)" variant="subtle" size="lg">
                {{ draw.status }}
              </UBadge>
            </div>
          </div>
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
          </template>
        </UAlert>

        <!-- Admin Override Toggle (only shown outside window) -->
        <div
          v-if="scheduleStatus && !scheduleStatus.isActive"
          class="flex items-center gap-3 mb-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <USwitch
            id="admin-override-draw"
            v-model="adminOverride"
            aria-describedby="admin-override-draw-desc"
          />
          <label
            id="admin-override-draw-desc"
            for="admin-override-draw"
            class="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
          >
            Admin Override (enable actions outside betting window)
          </label>
        </div>

        <!-- Matches List -->
        <div class="space-y-4">
          <UCard v-for="match in draw.matches" :key="match.id">
            <div class="space-y-4">
              <!-- Top Row: Match Number, Teams, and Actions -->
              <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                <!-- Match Number -->
                <div class="md:col-span-1">
                  <div class="text-2xl font-bold text-primary-500">
                    {{ match.match_number }}
                  </div>
                </div>

                <!-- Teams -->
                <div class="md:col-span-9">
                  <div class="space-y-1">
                    <div class="font-semibold">
                      {{ match.homeTeam.name }}
                      <span v-if="match.homeTeam.short_name" class="text-sm text-gray-500 ml-1"
                        >({{ match.homeTeam.short_name }})</span
                      >
                    </div>
                    <div class="font-semibold">
                      {{ match.awayTeam.name }}
                      <span v-if="match.awayTeam.short_name" class="text-sm text-gray-500 ml-1"
                        >({{ match.awayTeam.short_name }})</span
                      >
                    </div>
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {{ match.league.name }}
                    <span v-if="match.league.country"> • {{ match.league.country.name }}</span>
                    <span> • {{ formatDateTime(match.start_time) }}</span>
                  </div>
                </div>

                <!-- Actions -->
                <div class="md:col-span-2">
                  <div class="flex gap-2">
                    <UButton
                      size="xs"
                      color="neutral"
                      :loading="predicting[match.id]"
                      :disabled="!isActionAllowed"
                      @click="predictMatch(match.id)"
                    >
                      Predict
                    </UButton>
                    <UButton
                      v-if="match.predictions && match.predictions.length > 0"
                      size="xs"
                      color="warning"
                      variant="soft"
                      :disabled="predicting[match.id] || !isActionAllowed"
                      title="Re-evaluate with context"
                      @click="openReEvaluationModal(match)"
                    >
                      <UIcon name="i-heroicons-arrow-path" class="w-3 h-3" />
                    </UButton>
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      :loading="scraping[match.id]"
                      :disabled="!isActionAllowed"
                      @click="scrapeMatch(match.id)"
                    >
                      Scrape
                    </UButton>
                  </div>

                  <!-- Realtime Scraping Status -->
                  <div v-if="getScrapingStatus(match.id)" class="mt-2 space-y-1">
                    <div
                      v-for="(status, dataType) in getScrapingStatus(match.id)"
                      :key="dataType"
                      class="text-xs"
                    >
                      <UBadge
                        :color="getScrapingStatusColor(status.status)"
                        variant="subtle"
                        size="xs"
                      >
                        <span
                          v-if="status.status === 'in_progress'"
                          class="inline-flex items-center gap-1"
                        >
                          <span class="animate-pulse">●</span>
                          {{ status.message }}
                        </span>
                        <span
                          v-else-if="status.status === 'success'"
                          class="inline-flex items-center gap-1"
                        >
                          ✓ {{ status.message }}
                        </span>
                        <span
                          v-else-if="status.status === 'failed'"
                          class="inline-flex items-center gap-1"
                        >
                          ✗ {{ status.message }}
                        </span>
                        <span v-else>
                          {{ status.message }}
                        </span>
                      </UBadge>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Data Row: Odds, Distribution, and Prediction -->
              <div
                class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-200 dark:border-gray-700"
              >
                <!-- Market Odds -->
                <div>
                  <MatchOdds :match-odds="match.match_odds" />
                </div>

                <!-- Distribution Chart -->
                <div>
                  <DistributionChart
                    :svenska-folket-data="getSvenskaFolketData(match)"
                    :bet-metrics-data="getBetMetricsData(match)"
                  />
                </div>

                <!-- AI Prediction -->
                <div>
                  <div v-if="match.predictions && match.predictions[0]" class="space-y-2">
                    <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      AI Prediction
                    </div>
                    <div class="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
                      <div class="text-2xl font-bold text-primary-600 dark:text-primary-400 mb-2">
                        {{ match.predictions[0].predicted_outcome }}
                      </div>
                      <UBadge
                        :color="getConfidenceColor(match.predictions[0].confidence)"
                        variant="subtle"
                        size="sm"
                      >
                        {{ match.predictions[0].confidence }} confidence
                      </UBadge>
                      <div class="flex gap-3 text-xs mt-3 text-gray-600 dark:text-gray-400">
                        <span
                          >1:
                          {{
                            (Number(match.predictions[0].probability_home) * 100).toFixed(1)
                          }}%</span
                        >
                        <span
                          >X:
                          {{
                            (Number(match.predictions[0].probability_draw) * 100).toFixed(1)
                          }}%</span
                        >
                        <span
                          >2:
                          {{
                            (Number(match.predictions[0].probability_away) * 100).toFixed(1)
                          }}%</span
                        >
                      </div>
                      <div v-if="match.predictions[0].is_spik_suitable" class="mt-2">
                        <UBadge color="warning" variant="soft" size="sm">
                          🎯 Spik Candidate
                        </UBadge>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-sm text-gray-500">
                    <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      AI Prediction
                    </div>
                    No prediction yet
                  </div>
                </div>
              </div>

              <!-- Expandable Detail Sections -->
              <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div class="flex flex-wrap gap-2 mb-4" role="group" aria-label="Visa matchdetaljer">
                  <UButton
                    size="xs"
                    :variant="expandedSections[match.id]?.analysis ? 'solid' : 'ghost'"
                    :color="hasAnalysisData(match) ? 'primary' : 'neutral'"
                    :aria-expanded="expandedSections[match.id]?.analysis ?? false"
                    :aria-controls="`analysis-panel-${match.id}`"
                    @click="toggleSection(match.id, 'analysis')"
                  >
                    <UIcon name="i-heroicons-sparkles" class="w-3 h-3 mr-1" aria-hidden="true" />
                    AI Analysis
                    <UIcon
                      :name="
                        expandedSections[match.id]?.analysis
                          ? 'i-heroicons-chevron-up'
                          : 'i-heroicons-chevron-down'
                      "
                      class="w-3 h-3 ml-1"
                      aria-hidden="true"
                    />
                  </UButton>
                  <UButton
                    size="xs"
                    :variant="expandedSections[match.id]?.statistics ? 'solid' : 'ghost'"
                    :color="hasStatisticsData(match) ? 'primary' : 'neutral'"
                    :aria-expanded="expandedSections[match.id]?.statistics ?? false"
                    :aria-controls="`statistics-panel-${match.id}`"
                    @click="toggleSection(match.id, 'statistics')"
                  >
                    <UIcon name="i-heroicons-chart-bar" class="w-3 h-3 mr-1" aria-hidden="true" />
                    Statistics
                    <UIcon
                      :name="
                        expandedSections[match.id]?.statistics
                          ? 'i-heroicons-chevron-up'
                          : 'i-heroicons-chevron-down'
                      "
                      class="w-3 h-3 ml-1"
                      aria-hidden="true"
                    />
                  </UButton>
                  <UButton
                    size="xs"
                    :variant="expandedSections[match.id]?.h2h ? 'solid' : 'ghost'"
                    :color="hasH2HData(match) ? 'primary' : 'neutral'"
                    :aria-expanded="expandedSections[match.id]?.h2h ?? false"
                    :aria-controls="`h2h-panel-${match.id}`"
                    @click="toggleSection(match.id, 'h2h')"
                  >
                    <UIcon name="i-heroicons-users" class="w-3 h-3 mr-1" aria-hidden="true" />
                    Head-to-Head
                    <UIcon
                      :name="
                        expandedSections[match.id]?.h2h
                          ? 'i-heroicons-chevron-up'
                          : 'i-heroicons-chevron-down'
                      "
                      class="w-3 h-3 ml-1"
                      aria-hidden="true"
                    />
                  </UButton>
                  <UButton
                    size="xs"
                    :variant="expandedSections[match.id]?.odds ? 'solid' : 'ghost'"
                    :color="hasOddsData(match) ? 'primary' : 'neutral'"
                    :aria-expanded="expandedSections[match.id]?.odds ?? false"
                    :aria-controls="`odds-panel-${match.id}`"
                    @click="toggleSection(match.id, 'odds')"
                  >
                    <UIcon name="i-heroicons-scale" class="w-3 h-3 mr-1" aria-hidden="true" />
                    Odds Comparison
                    <UIcon
                      :name="
                        expandedSections[match.id]?.odds
                          ? 'i-heroicons-chevron-up'
                          : 'i-heroicons-chevron-down'
                      "
                      class="w-3 h-3 ml-1"
                      aria-hidden="true"
                    />
                  </UButton>
                </div>

                <!-- AI Analysis Section -->
                <Transition name="slide">
                  <div
                    v-if="expandedSections[match.id]?.analysis"
                    :id="`analysis-panel-${match.id}`"
                    class="mb-4"
                    role="region"
                    aria-label="AI-analys"
                  >
                    <MatchAIAnalysis :prediction="match.predictions?.[0]" />
                  </div>
                </Transition>

                <!-- Statistics Section -->
                <Transition name="slide">
                  <div
                    v-if="expandedSections[match.id]?.statistics"
                    :id="`statistics-panel-${match.id}`"
                    class="mb-4"
                    role="region"
                    aria-label="Statistik"
                  >
                    <MatchStatistics
                      :scraped-data="match.match_scraped_data"
                      :home-team-name="match.homeTeam.name"
                      :away-team-name="match.awayTeam.name"
                    />
                  </div>
                </Transition>

                <!-- Head-to-Head Section -->
                <Transition name="slide">
                  <div
                    v-if="expandedSections[match.id]?.h2h"
                    :id="`h2h-panel-${match.id}`"
                    class="mb-4"
                    role="region"
                    aria-label="Head-to-Head"
                  >
                    <MatchHeadToHead
                      :scraped-data="match.match_scraped_data"
                      :home-team-name="match.homeTeam.name"
                      :away-team-name="match.awayTeam.name"
                    />
                  </div>
                </Transition>

                <!-- Odds Comparison Section -->
                <Transition name="slide">
                  <div
                    v-if="expandedSections[match.id]?.odds"
                    :id="`odds-panel-${match.id}`"
                    class="mb-4"
                    role="region"
                    aria-label="Oddsjämförelse"
                  >
                    <MatchOddsComparison
                      :match-odds="match.match_odds"
                      :prediction="match.predictions?.[0]"
                      :scraped-data="match.match_scraped_data"
                    />
                  </div>
                </Transition>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Footer Actions -->
        <div class="mt-8 flex gap-4">
          <UTooltip
            :text="
              !isActionAllowed
                ? 'Disabled outside betting window. Enable admin override to proceed.'
                : 'Re-evaluate all predictions with fresh context'
            "
          >
            <UButton
              v-if="hasAnyPredictions(draw)"
              color="warning"
              variant="soft"
              size="lg"
              :loading="reEvaluatingAll"
              :disabled="!isActionAllowed"
              @click="reEvaluateAllModal = true"
            >
              <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 mr-2" />
              Re-evaluate All Matches
            </UButton>
          </UTooltip>
          <UTooltip
            :text="
              !isActionAllowed
                ? 'Disabled outside betting window. Enable admin override to proceed.'
                : !isDrawReady(draw)
                  ? 'All 13 matches need predictions first'
                  : 'Generate optimal coupon'
            "
          >
            <UButton
              :to="`/draw/${drawId}/optimize`"
              color="primary"
              size="lg"
              :disabled="!isDrawReady(draw) || !isActionAllowed"
            >
              Generate Optimal Coupon
            </UButton>
          </UTooltip>
        </div>
      </div>
    </UContainer>

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
      @update:model-value="reEvaluateAllModal = $event"
      @confirmed="handleReEvaluateAllConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
import type { RealtimeScrapingStatus, ScheduleWindowStatus } from '~/types'

const route = useRoute()
const drawId = route.params.id as string

useHead({
  title: `Draw #${drawId} - Stryktipset AI Predictor`,
})

// Schedule window states
const scheduleStatus = ref<ScheduleWindowStatus | null>(null)
const adminOverride = ref(false)

// Computed property for action buttons
const isActionAllowed = computed(() => {
  if (!scheduleStatus.value) return true // Allow if status not loaded yet
  return scheduleStatus.value.isActive || adminOverride.value
})

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

const predicting = ref<Record<number, boolean>>({})
const scraping = ref<Record<number, boolean>>({})

// Re-evaluation modal states
const reEvaluationModal = ref({
  isOpen: false,
  matchId: 0,
  homeTeam: '',
  awayTeam: '',
  currentPrediction: null as CurrentPrediction | null,
})
const reEvaluateAllModal = ref(false)
const reEvaluatingAll = ref(false)

// Track expanded sections per match
interface ExpandedState {
  analysis: boolean
  statistics: boolean
  h2h: boolean
  odds: boolean
}
const expandedSections = ref<Record<number, ExpandedState>>({})

// Toggle a section for a match
const toggleSection = (matchId: number, section: keyof ExpandedState) => {
  if (!expandedSections.value[matchId]) {
    expandedSections.value[matchId] = {
      analysis: false,
      statistics: false,
      h2h: false,
      odds: false,
    }
  }
  expandedSections.value[matchId][section] = !expandedSections.value[matchId][section]
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Match data has dynamic shape from API */
// Check if match has analysis data (reasoning, key_factors, similar_matches)
const hasAnalysisData = (match: any) => {
  const prediction = match.predictions?.[0]
  return prediction?.reasoning || prediction?.key_factors || prediction?.similar_matches
}

// Check if match has statistics data (xStats or statistics with actual data)
const hasStatisticsData = (match: any) => {
  if (!match.match_scraped_data) return false
  return match.match_scraped_data.some((d: any) => {
    if (d.data_type === 'xStats') {
      // Check if xStats has actual values (not all nulls)
      const data = d.data
      return data?.homeTeam?.xg || data?.awayTeam?.xg
    }
    if (d.data_type === 'statistics') {
      // Check if statistics has actual values
      const data = d.data
      const hasHome = data?.homeTeam?.position || data?.homeTeam?.points || data?.homeTeam?.form
      const hasAway = data?.awayTeam?.position || data?.awayTeam?.points || data?.awayTeam?.form
      return hasHome || hasAway
    }
    return false
  })
}

// Check if match has H2H data with actual matches
const hasH2HData = (match: any) => {
  if (!match.match_scraped_data) return false
  const h2h = match.match_scraped_data.find((d: any) => d.data_type === 'headToHead')
  return h2h?.data?.matches && h2h.data.matches.length > 0
}

// Check if match has odds data for comparison
const hasOddsData = (match: any) => {
  // Check match_odds table
  if (match.match_odds && match.match_odds.length > 0) {
    const odds = match.match_odds[0]
    if (odds.svenska_folket_home || odds.home_odds) return true
  }
  // Check scraped data for svenskaFolket or expertTips
  if (match.match_scraped_data) {
    const hasSF = match.match_scraped_data.some(
      (d: any) => d.data_type === 'svenskaFolket' && d.data?.one
    )
    const hasET = match.match_scraped_data.some(
      (d: any) => d.data_type === 'expertTips' && d.data?.one !== undefined
    )
    if (hasSF || hasET) return true
  }
  // Check predictions
  return !!match.predictions?.[0]
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface Team {
  name: string
  short_name?: string
}

interface League {
  name: string
  country?: { name: string }
}

interface SimilarMatch {
  homeTeam?: string
  home_team?: string
  awayTeam?: string
  away_team?: string
  date?: string
  match_date?: string
  league?: string
  competition?: string
  score?: string
  result?: string
  outcome?: string
  similarity?: number
}

interface MatchOdds {
  type?: 'current' | 'start' | string
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

interface CurrentPrediction {
  predicted_outcome: string
  confidence: string
  probability_home: number
  probability_draw: number
  probability_away: number
  is_spik_suitable?: boolean
  reasoning?: string
  key_factors?: string[] | string
  similar_matches?: SimilarMatch[] | string
  user_context?: string
  is_reevaluation?: boolean
}

interface ScrapedDataItem {
  data_type: string
  data: unknown
}

interface Match {
  id: number
  match_number: number
  homeTeam: Team
  awayTeam: Team
  league: League
  start_time: string
  predictions?: CurrentPrediction[]
  match_odds?: MatchOdds[]
  match_scraped_data?: ScrapedDataItem[]
}

interface Draw {
  draw_number: number
  draw_date: string
  close_time: string
  status: string
  matches?: Match[]
}

const {
  data: response,
  pending,
  refresh,
} = await useFetch<{
  success: boolean
  draw?: Draw
}>(`/api/draws/${drawId}`)
const draw = computed(() => response.value?.draw)

// Track scraping updates per match
const scrapingUpdates = ref<Record<number, ReturnType<typeof useScrapingUpdates> | null>>({})

// Initialize scraping updates for each match during setup (not in click handlers)
watch(
  draw,
  newDraw => {
    const drawData = newDraw as { matches?: Array<{ id: number }> } | undefined
    if (drawData?.matches) {
      drawData.matches.forEach(match => {
        if (!scrapingUpdates.value[match.id]) {
          // Initialize composable during component setup via watch
          // This ensures lifecycle hooks work properly
          scrapingUpdates.value[match.id] = useScrapingUpdates(match.id)
        }
      })
    }
  },
  { immediate: true }
)

const predictMatch = async (matchId: number) => {
  predicting.value[matchId] = true
  try {
    await $fetch(`/api/matches/${matchId}/predict`, { method: 'POST' })
    await refresh()
  } catch (error) {
    console.error('Error predicting match:', error)
  } finally {
    predicting.value[matchId] = false
  }
}

const scrapeMatch = async (matchId: number) => {
  scraping.value[matchId] = true

  try {
    await $fetch(`/api/matches/${matchId}/scrape`, {
      method: 'POST',
      body: { dataTypes: ['xStats', 'statistics', 'headToHead', 'news', 'lineup'] },
    })
    await refresh()
  } catch (error) {
    console.error('Error scraping match:', error)
  } finally {
    scraping.value[matchId] = false
  }
}

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

const getConfidenceColor = (confidence: string) => {
  switch (confidence) {
    case 'high':
      return 'success'
    case 'medium':
      return 'warning'
    case 'low':
      return 'error'
    default:
      return 'neutral'
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Draw/match data has dynamic shape from API */
const isDrawReady = (draw: any) => {
  if (!draw.matches || draw.matches.length !== 13) return false
  return draw.matches.every((m: any) => m.predictions && m.predictions.length > 0)
}

const hasAnyPredictions = (draw: any) => {
  if (!draw.matches) return false
  return draw.matches.some((m: any) => m.predictions && m.predictions.length > 0)
}

const openReEvaluationModal = (match: any) => {
  reEvaluationModal.value = {
    isOpen: true,
    matchId: match.id,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    currentPrediction: match.predictions?.[0] || null,
  }
}

const handleReEvaluated = async () => {
  await refresh()
}

const handleReEvaluateAllConfirmed = async () => {
  reEvaluatingAll.value = true
  await refresh()
  reEvaluatingAll.value = false
}

const getSvenskaFolketData = (match: any) => {
  const scrapedData = match.match_scraped_data?.find((d: any) => d.data_type === 'svenskaFolket')
  return scrapedData?.data || null
}

const getBetMetricsData = (match: any) => {
  const scrapedData = match.match_scraped_data?.find((d: any) => d.data_type === 'betMetrics')
  return scrapedData?.data || null
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Get scraping status for a specific match
const getScrapingStatus = (matchId: number): Record<string, RealtimeScrapingStatus> | null => {
  const updates = scrapingUpdates.value[matchId]
  if (!updates) return null

  const status = updates.scrapingStatus.value

  // Check if status exists and is an object
  if (!status || typeof status !== 'object') return null

  // Only show status if at least one data type is actively scraping or recently completed
  const hasActiveOrRecent = Object.values(status).some(
    s =>
      s.status === 'in_progress' ||
      s.status === 'started' ||
      (s.status === 'success' && s.completedAt && Date.now() - s.completedAt.getTime() < 10000) // Show success for 10 seconds
  )

  return hasActiveOrRecent ? status : null
}

// Get color for scraping status badge
const getScrapingStatusColor = (status: RealtimeScrapingStatus['status']) => {
  switch (status) {
    case 'started':
    case 'in_progress':
      return 'primary'
    case 'success':
      return 'success'
    case 'failed':
      return 'error'
    case 'rate_limited':
      return 'warning'
    default:
      return 'neutral'
  }
}

// Cleanup on unmount
onUnmounted(() => {
  if (scrapingUpdates.value && typeof scrapingUpdates.value === 'object') {
    Object.values(scrapingUpdates.value).forEach(update => {
      if (update) {
        update.cleanup()
      }
    })
  }
})
</script>

<style scoped>
/* Slide transition for expandable sections */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 1000px;
  transform: translateY(0);
}
</style>
