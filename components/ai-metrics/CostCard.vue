<template>
  <UCard>
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ title }}
        </p>
        <UIcon
          v-if="icon"
          :name="icon"
          class="w-5 h-5 text-gray-400"
        />
      </div>
      <div class="flex items-baseline gap-2">
        <p
          class="text-3xl font-bold"
          :class="valueClass"
        >
          {{ formattedValue }}
        </p>
        <p
          v-if="change !== undefined"
          class="text-sm font-medium"
          :class="changeClass"
        >
          {{ changePrefix }}{{ Math.abs(change).toFixed(1) }}%
        </p>
      </div>
      <p
        v-if="subtitle"
        class="text-xs text-gray-500 dark:text-gray-400"
      >
        {{ subtitle }}
      </p>
    </div>
  </UCard>
</template>

<script setup lang="ts">
interface Props {
  title: string
  value: number | string
  icon?: string
  subtitle?: string
  change?: number
  format?: 'number' | 'currency' | 'percentage'
  decimals?: number
  colorClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  format: 'number',
  decimals: 0,
})

const formattedValue = computed(() => {
  if (typeof props.value === 'string') return props.value

  switch (props.format) {
    case 'currency':
      return `$${props.value.toFixed(props.decimals)}`
    case 'percentage':
      return `${props.value.toFixed(props.decimals)}%`
    default:
      return props.value.toLocaleString('en-US', {
        maximumFractionDigits: props.decimals,
      })
  }
})

const valueClass = computed(() => {
  return props.colorClass || 'text-gray-900 dark:text-gray-100'
})

const changeClass = computed(() => {
  if (props.change === undefined) return ''
  if (props.change > 0) return 'text-red-500'
  if (props.change < 0) return 'text-green-500'
  return 'text-gray-500'
})

const changePrefix = computed(() => {
  if (props.change === undefined) return ''
  return props.change > 0 ? '+' : ''
})
</script>
