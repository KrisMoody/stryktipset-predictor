<template>
  <UCard :ui="cardUI">
    <div class="flex gap-4">
      <div class="flex-shrink-0">
        <UIcon :name="iconName" :class="iconClass" class="w-6 h-6" />
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {{ recommendation.title }}
        </h4>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {{ recommendation.description }}
        </p>
        <p
          v-if="recommendation.potentialSavings"
          class="text-sm font-medium text-green-600 dark:text-green-400 mb-2"
        >
          Potential savings: ${{ recommendation.potentialSavings.toFixed(4) }}
        </p>
        <p v-if="recommendation.action" class="text-sm text-gray-700 dark:text-gray-300">
          <strong>Action:</strong> {{ recommendation.action }}
        </p>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { OptimizationRecommendation } from '~/types'

interface Props {
  recommendation: OptimizationRecommendation
}

const props = defineProps<Props>()

const iconName = computed(() => {
  switch (props.recommendation.type) {
    case 'cost':
      return 'i-heroicons-currency-dollar'
    case 'efficiency':
      return 'i-heroicons-lightning-bolt'
    case 'performance':
      return 'i-heroicons-chart-bar'
    case 'info':
      return 'i-heroicons-information-circle'
    default:
      return 'i-heroicons-light-bulb'
  }
})

const iconClass = computed(() => {
  switch (props.recommendation.severity) {
    case 'high':
      return 'text-red-500'
    case 'medium':
      return 'text-yellow-500'
    case 'low':
      return 'text-blue-500'
    default:
      return 'text-gray-500'
  }
})

const cardUI = computed(() => {
  const baseClasses = 'border-l-4'
  let borderColor = 'border-l-gray-300'

  switch (props.recommendation.severity) {
    case 'high':
      borderColor = 'border-l-red-500'
      break
    case 'medium':
      borderColor = 'border-l-yellow-500'
      break
    case 'low':
      borderColor = 'border-l-blue-500'
      break
  }

  return {
    root: `${baseClasses} ${borderColor}`,
  }
})
</script>
