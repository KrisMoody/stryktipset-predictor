<template>
  <UCard>
    <template #header>
      <h3 class="text-lg font-semibold">
        {{ title }}
      </h3>
    </template>

    <div
      v-if="loading"
      class="flex justify-center py-8"
    >
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>

    <div
      v-else-if="data && data.length > 0"
      class="space-y-4"
    >
      <div
        v-for="item in data"
        :key="'model' in item ? item.model : item.dataType"
        class="border-b border-gray-200 dark:border-gray-700 last:border-b-0 pb-4 last:pb-0"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex-1">
            <h4 class="font-medium text-gray-900 dark:text-gray-100">
              {{ getDisplayName(item) }}
            </h4>
            <p
              v-if="'description' in item && item.description"
              class="text-xs text-gray-500 dark:text-gray-400 mt-1"
            >
              {{ item.description }}
            </p>
          </div>
          <div class="text-right">
            <p class="font-semibold text-gray-900 dark:text-gray-100">
              ${{ item.totalCost.toFixed(4) }}
            </p>
            <p class="text-xs text-gray-500">
              {{ item.requests }} requests
            </p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4 mt-2 text-sm">
          <div>
            <p class="text-gray-500 dark:text-gray-400 text-xs">
              Tokens
            </p>
            <p class="font-medium">
              {{ formatNumber(item.totalTokens) }}
            </p>
          </div>
          <div>
            <p class="text-gray-500 dark:text-gray-400 text-xs">
              Avg Cost
            </p>
            <p class="font-medium">
              ${{ item.averageCostPerRequest.toFixed(6) }}
            </p>
          </div>
          <div>
            <p class="text-gray-500 dark:text-gray-400 text-xs">
              Success Rate
            </p>
            <p
              class="font-medium"
              :class="getSuccessRateClass(item.successRate)"
            >
              {{ item.successRate.toFixed(1) }}%
            </p>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      class="text-center py-8 text-gray-500"
    >
      No data available
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { ModelCostBreakdown, OperationCostBreakdown } from '~/types'

interface Props {
  title: string
  data: ModelCostBreakdown[] | OperationCostBreakdown[] | null
  loading?: boolean
}

defineProps<Props>()

function getDisplayName(item: ModelCostBreakdown | OperationCostBreakdown): string {
  if ('model' in item) {
    return item.model
  }
  if ('dataType' in item) {
    // Format data type for display
    const typeMap: Record<string, string> = {
      prediction: 'Match Predictions',
      embedding: 'Vector Embeddings',
      xStats: 'xStats Scraping',
      statistics: 'Statistics Scraping',
      headToHead: 'Head-to-Head Scraping',
      news: 'News Scraping',
    }
    return typeMap[item.dataType] || item.dataType
  }
  return 'Unknown'
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toLocaleString()
}

function getSuccessRateClass(rate: number): string {
  if (rate >= 95) return 'text-green-600 dark:text-green-400'
  if (rate >= 85) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}
</script>
