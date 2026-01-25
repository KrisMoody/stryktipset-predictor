<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Score Distribution</h4>
      <div v-if="totalRows > 0" class="text-xs text-gray-500 dark:text-gray-400">
        {{ totalRows }} total rows analyzed
      </div>
    </div>

    <!-- Bar Chart -->
    <div v-if="hasData" class="space-y-2">
      <div v-for="score in scores" :key="score" class="flex items-center gap-3">
        <div class="w-16 text-sm font-medium text-gray-600 dark:text-gray-400">
          {{ score }} rätt
        </div>
        <div class="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="getBarColor(score)"
            :style="{ width: `${getBarWidth(score)}%` }"
          />
        </div>
        <div class="w-20 text-right">
          <span class="text-sm font-semibold">{{ distribution[score] || 0 }}</span>
          <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">
            ({{ getPercentage(score) }}%)
          </span>
        </div>
      </div>
    </div>

    <!-- Hit Rates Summary -->
    <div v-if="hasData" class="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
      <div class="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div class="text-lg font-bold" :class="hitRate13 > 0 ? 'text-yellow-500' : 'text-gray-400'">
          {{ hitRate13.toFixed(1) }}%
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">13 rätt</div>
      </div>
      <div class="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div class="text-lg font-bold text-green-600 dark:text-green-400">
          {{ hitRate12Plus.toFixed(1) }}%
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">12+ rätt</div>
      </div>
      <div class="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div class="text-lg font-bold text-blue-600 dark:text-blue-400">
          {{ hitRate11Plus.toFixed(1) }}%
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">11+ rätt</div>
      </div>
      <div class="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div class="text-lg font-bold text-primary-600 dark:text-primary-400">
          {{ hitRate10Plus.toFixed(1) }}%
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">10+ rätt</div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-6 text-gray-500 dark:text-gray-400">
      No score distribution data available
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  distribution: Record<number, number>
}>()

const scores = [13, 12, 11, 10] as const

const hasData = computed(() => {
  return Object.values(props.distribution).some(v => v > 0)
})

const totalRows = computed(() => {
  return Object.values(props.distribution).reduce((sum, count) => sum + count, 0)
})

const getBarWidth = (score: number) => {
  if (totalRows.value === 0) return 0
  const count = props.distribution[score] || 0
  // Scale to make bars more visible
  const maxCount = Math.max(...Object.values(props.distribution), 1)
  return (count / maxCount) * 100
}

const getPercentage = (score: number) => {
  if (totalRows.value === 0) return '0.0'
  const count = props.distribution[score] || 0
  return ((count / totalRows.value) * 100).toFixed(1)
}

const getBarColor = (score: number) => {
  switch (score) {
    case 13:
      return 'bg-yellow-500'
    case 12:
      return 'bg-green-500'
    case 11:
      return 'bg-blue-500'
    case 10:
      return 'bg-primary-500'
    default:
      return 'bg-gray-400'
  }
}

// Hit rate calculations
const hitRate13 = computed(() => {
  if (totalRows.value === 0) return 0
  return ((props.distribution[13] || 0) / totalRows.value) * 100
})

const hitRate12Plus = computed(() => {
  if (totalRows.value === 0) return 0
  const count = (props.distribution[12] || 0) + (props.distribution[13] || 0)
  return (count / totalRows.value) * 100
})

const hitRate11Plus = computed(() => {
  if (totalRows.value === 0) return 0
  const count = (props.distribution[11] || 0) + (props.distribution[12] || 0) + (props.distribution[13] || 0)
  return (count / totalRows.value) * 100
})

const hitRate10Plus = computed(() => {
  if (totalRows.value === 0) return 0
  const count = (props.distribution[10] || 0) + (props.distribution[11] || 0) + (props.distribution[12] || 0) + (props.distribution[13] || 0)
  return (count / totalRows.value) * 100
})
</script>
