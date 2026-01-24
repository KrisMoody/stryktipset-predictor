<template>
  <div class="match-card-v2">
    <div class="match-card-v2__header flex items-center justify-between">
      <div class="flex items-center gap-3">
        <ProgressRing :value="predictedCount" :max="totalMatches" :size="48" :stroke-width="4" />
        <div>
          <h3 class="font-semibold text-gray-900 dark:text-white">Draw #{{ draw.draw_number }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ gameTypeLabel }}
          </p>
        </div>
      </div>
      <UBadge :color="statusColor" variant="subtle">
        {{ draw.status }}
      </UBadge>
    </div>

    <div class="match-card-v2__body">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-gray-500 dark:text-gray-400">Matches</span>
          <p class="font-medium text-gray-900 dark:text-white">
            {{ predictedCount }}/{{ totalMatches }} predicted
          </p>
        </div>
        <div>
          <span class="text-gray-500 dark:text-gray-400">Closes</span>
          <p class="font-medium text-gray-900 dark:text-white">
            {{ formatCloseTime }}
          </p>
        </div>
        <div>
          <span class="text-gray-500 dark:text-gray-400">Net Sale</span>
          <p class="font-medium text-gray-900 dark:text-white">
            {{ formatCurrency(draw.net_sale) }}
          </p>
        </div>
        <div>
          <span class="text-gray-500 dark:text-gray-400">Value Opportunities</span>
          <p class="font-medium text-green-600 dark:text-green-400">
            {{ valueOpportunities }}
          </p>
        </div>
      </div>
    </div>

    <div class="match-card-v2__footer flex items-center gap-2">
      <UButton
        :to="{ path: `/draw/${draw.draw_number}`, query: { gameType: draw.game_type } }"
        color="primary"
        size="sm"
      >
        View Matches
      </UButton>
      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        :loading="fetchingData"
        :disabled="!canFetch"
        @click="$emit('fetchData')"
      >
        <UIcon name="i-heroicons-arrow-down-tray" class="w-3 h-3 mr-1" />
        Fetch Data
      </UButton>
      <UButton
        v-if="!isComplete"
        color="success"
        variant="soft"
        size="sm"
        :loading="generating"
        :disabled="!canGenerate"
        @click="$emit('generate')"
      >
        Generate Predictions
      </UButton>
      <UButton
        v-if="isComplete"
        :to="{ path: `/draw/${draw.draw_number}/optimize`, query: { gameType: draw.game_type } }"
        color="primary"
        variant="soft"
        size="sm"
      >
        Optimize Coupon
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
interface DrawData {
  id: number
  draw_number: number
  draw_date: string
  close_time: string
  status: string
  net_sale?: string | number
  game_type: string
  matches?: { id: number; predictions?: { id: number }[] }[]
}

const props = defineProps<{
  draw: DrawData
  generating?: boolean
  canGenerate?: boolean
  fetchingData?: boolean
  canFetch?: boolean
}>()

defineEmits<{
  generate: []
  fetchData: []
}>()

const totalMatches = computed(() => props.draw.matches?.length || 0)

const predictedCount = computed(() => {
  if (!props.draw.matches) return 0
  return props.draw.matches.filter(m => m.predictions && m.predictions.length > 0).length
})

const isComplete = computed(() => {
  return totalMatches.value > 0 && predictedCount.value === totalMatches.value
})

const valueOpportunities = computed(() => {
  // TODO: Calculate actual value opportunities from match calculations
  return 0
})

const gameTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    stryktipset: 'Stryktipset',
    europatipset: 'Europatipset',
    topptipset: 'Topptipset',
  }
  return labels[props.draw.game_type] || props.draw.game_type
})

const statusColor = computed(() => {
  switch (props.draw.status) {
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

const formatCloseTime = computed(() => {
  return new Date(props.draw.close_time).toLocaleString('sv-SE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

function formatCurrency(amount: string | number | undefined): string {
  if (!amount) return 'N/A'
  return `${parseFloat(String(amount)).toLocaleString('sv-SE')} SEK`
}
</script>
