<template>
  <div class="relative inline-flex items-center justify-center">
    <svg :width="size" :height="size" class="progress-ring">
      <!-- Background circle -->
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke="bgColor"
        :stroke-width="strokeWidth"
      />
      <!-- Progress circle -->
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke="progressColor"
        :stroke-width="strokeWidth"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        stroke-linecap="round"
        class="progress-ring__circle"
      />
    </svg>
    <!-- Center content -->
    <div class="absolute inset-0 flex items-center justify-center">
      <slot>
        <span class="text-sm font-semibold" :class="textColorClass">
          {{ displayValue }}
        </span>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    value: number
    max: number
    size?: number
    strokeWidth?: number
    showPercentage?: boolean
  }>(),
  {
    size: 64,
    strokeWidth: 6,
    showPercentage: false,
  }
)

const center = computed(() => props.size / 2)
const radius = computed(() => (props.size - props.strokeWidth) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

const percentage = computed(() => {
  if (props.max === 0) return 0
  return Math.min(100, (props.value / props.max) * 100)
})

const dashOffset = computed(() => {
  return circumference.value - (percentage.value / 100) * circumference.value
})

const displayValue = computed(() => {
  if (props.showPercentage) {
    return `${Math.round(percentage.value)}%`
  }
  return `${props.value}/${props.max}`
})

// Color based on percentage
const progressColor = computed(() => {
  if (percentage.value >= 100) return 'var(--ui-color-green-500)'
  if (percentage.value >= 50) return 'var(--ui-color-yellow-500)'
  return 'var(--ui-color-red-500)'
})

const bgColor = computed(() => {
  return 'var(--ui-color-gray-200)'
})

const textColorClass = computed(() => {
  if (percentage.value >= 100) return 'text-green-600 dark:text-green-400'
  if (percentage.value >= 50) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
})
</script>
