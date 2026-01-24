<template>
  <div class="quick-stats">
    <div class="quick-stat">
      <div class="flex items-center gap-2 mb-1">
        <UIcon name="i-heroicons-queue-list" class="w-5 h-5 text-primary-500" />
        <span class="quick-stat__label">Active Draws</span>
      </div>
      <div class="quick-stat__value">{{ stats.activeDraws }}</div>
    </div>

    <div class="quick-stat">
      <div class="flex items-center gap-2 mb-1">
        <UIcon name="i-heroicons-clock" class="w-5 h-5 text-warning-500" />
        <span class="quick-stat__label">Pending Predictions</span>
      </div>
      <div class="quick-stat__value">{{ stats.pendingPredictions }}</div>
    </div>

    <div class="quick-stat">
      <div class="flex items-center gap-2 mb-1">
        <UIcon name="i-heroicons-currency-dollar" class="w-5 h-5 text-success-500" />
        <span class="quick-stat__label">Value Opportunities</span>
      </div>
      <div class="quick-stat__value">{{ stats.valueOpportunities }}</div>
    </div>

    <div class="quick-stat">
      <div class="flex items-center gap-2 mb-1">
        <UIcon name="i-heroicons-bell-alert" class="w-5 h-5 text-error-500" />
        <span class="quick-stat__label">Next Close</span>
      </div>
      <div class="quick-stat__value text-lg">{{ stats.nextCloseTime || 'N/A' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface QuickStatsData {
  activeDraws: number
  pendingPredictions: number
  valueOpportunities: number
  nextCloseTime: string | null
}

defineProps<{
  stats: QuickStatsData
}>()
</script>
