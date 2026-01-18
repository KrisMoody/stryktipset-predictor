<template>
  <UBadge v-if="show" :color="badgeColor" variant="soft" size="xs" class="font-semibold">
    VALUE {{ evPercent }}
  </UBadge>
</template>

<script setup lang="ts">
const props = defineProps<{
  bestValueOutcome: '1' | 'X' | '2' | null
  evHome: number
  evDraw: number
  evAway: number
  threshold?: number
}>()

const threshold = computed(() => props.threshold ?? 0.03)

const bestEv = computed(() => {
  if (!props.bestValueOutcome) return null

  switch (props.bestValueOutcome) {
    case '1':
      return props.evHome
    case 'X':
      return props.evDraw
    case '2':
      return props.evAway
    default:
      return null
  }
})

const show = computed(() => {
  return bestEv.value !== null && bestEv.value > threshold.value
})

const evPercent = computed(() => {
  if (bestEv.value === null) return ''
  return `+${(bestEv.value * 100).toFixed(0)}%`
})

const badgeColor = computed((): 'warning' | 'success' | 'primary' | 'neutral' => {
  if (bestEv.value === null) return 'neutral'
  if (bestEv.value > 0.1) return 'warning' // Gold for >10%
  if (bestEv.value > 0.05) return 'success' // Green for 5-10%
  return 'primary' // Blue for 3-5%
})
</script>
