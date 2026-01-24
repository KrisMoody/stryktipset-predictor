<template>
  <div class="flex items-center gap-3">
    <!-- Circular gauge -->
    <div class="relative w-12 h-12 rounded-full" :style="gaugeStyle">
      <div
        class="absolute inset-1 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center"
      >
        <span class="text-xs font-bold" :class="textColorClass"> {{ percentage }}% </span>
      </div>
    </div>

    <!-- Label -->
    <div v-if="showLabel">
      <div class="text-sm font-medium" :class="textColorClass">
        {{ confidenceLabel }}
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400">Confidence</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    confidence: 'low' | 'medium' | 'high' | string
    showLabel?: boolean
  }>(),
  {
    showLabel: true,
  }
)

const percentage = computed(() => {
  switch (props.confidence) {
    case 'high':
      return 85
    case 'medium':
      return 60
    case 'low':
      return 35
    default:
      return 50
  }
})

const confidenceLabel = computed(() => {
  switch (props.confidence) {
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    case 'low':
      return 'Low'
    default:
      return props.confidence
  }
})

const color = computed(() => {
  switch (props.confidence) {
    case 'high':
      return 'var(--confidence-high)'
    case 'medium':
      return 'var(--confidence-medium)'
    case 'low':
      return 'var(--confidence-low)'
    default:
      return 'var(--confidence-medium)'
  }
})

const gaugeStyle = computed(() => {
  const pct = percentage.value
  return {
    background: `conic-gradient(${color.value} ${pct}%, var(--ui-color-gray-200) ${pct}%)`,
  }
})

const textColorClass = computed(() => {
  switch (props.confidence) {
    case 'high':
      return 'text-green-600 dark:text-green-400'
    case 'medium':
      return 'text-yellow-600 dark:text-yellow-400'
    case 'low':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
})
</script>
