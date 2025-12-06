<template>
  <div v-if="hasData" class="space-y-3">
    <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">Svenska Folket (Crowd)</div>

    <div class="space-y-2">
      <div v-for="outcome in outcomes" :key="outcome.label" class="space-y-1">
        <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>{{ outcome.label }}</span>
          <div class="flex gap-2">
            <span class="font-semibold">{{ outcome.current }}%</span>
            <span v-if="outcome.ref" class="text-gray-500 dark:text-gray-400">
              ({{ outcome.ref }}%)
            </span>
          </div>
        </div>
        <div class="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            class="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
            :class="outcome.color"
            :style="{ width: outcome.current + '%' }"
          />
        </div>
      </div>
    </div>

    <!-- Distribution from betMetrics if available -->
    <div v-if="betMetricsData" class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
      <div class="text-xs text-gray-600 dark:text-gray-400 mb-2">
        Bet Distribution
        <span v-if="distributionDate" class="ml-2 text-gray-500 dark:text-gray-400">
          ({{ formatDate(distributionDate) }})
        </span>
      </div>
      <div class="flex gap-3 text-xs">
        <span v-for="value in betMetricsData.values" :key="value.outcome">
          {{ value.outcome }}: {{ value.distribution.distribution }}%
        </span>
      </div>
    </div>
  </div>

  <div v-else class="text-sm text-gray-500 dark:text-gray-400">No distribution data available</div>
</template>

<script setup lang="ts">
interface Props {
  svenskaFolketData?: {
    one?: string
    x?: string
    two?: string
    refOne?: string
    refX?: string
    refTwo?: string
  }
  betMetricsData?: {
    distributionDate?: string
    values?: Array<{
      outcome: string
      distribution: {
        distribution: string
        refDistribution?: string
      }
    }>
  }
}

const props = defineProps<Props>()

const hasData = computed(() => {
  return (
    !!props.svenskaFolketData?.one || !!props.svenskaFolketData?.x || !!props.svenskaFolketData?.two
  )
})

const distributionDate = computed(() => {
  return props.betMetricsData?.distributionDate
})

const outcomes = computed(() => {
  if (!props.svenskaFolketData) return []

  return [
    {
      label: '1 (Home)',
      current: props.svenskaFolketData.one || '0',
      ref: props.svenskaFolketData.refOne,
      color: 'bg-blue-500',
    },
    {
      label: 'X (Draw)',
      current: props.svenskaFolketData.x || '0',
      ref: props.svenskaFolketData.refX,
      color: 'bg-gray-500',
    },
    {
      label: '2 (Away)',
      current: props.svenskaFolketData.two || '0',
      ref: props.svenskaFolketData.refTwo,
      color: 'bg-green-500',
    },
  ]
})

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleString('sv-SE', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
</script>
