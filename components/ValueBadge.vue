<template>
  <span v-if="shouldShow" :class="badgeClass">
    <UIcon :name="icon" class="w-3 h-3" />
    <span>{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  ev: number // Expected value as decimal (0.05 = 5%)
}>()

const shouldShow = computed(() => props.ev >= 0.03) // Only show for 3%+ EV

const tier = computed(() => {
  if (props.ev >= 0.1) return 'exceptional'
  if (props.ev >= 0.05) return 'strong'
  if (props.ev >= 0.03) return 'opportunity'
  return null
})

const label = computed(() => {
  const pct = (props.ev * 100).toFixed(1)
  switch (tier.value) {
    case 'exceptional':
      return `+${pct}% EV`
    case 'strong':
      return `+${pct}% EV`
    case 'opportunity':
      return `+${pct}% EV`
    default:
      return ''
  }
})

const icon = computed(() => {
  switch (tier.value) {
    case 'exceptional':
      return 'i-heroicons-fire'
    case 'strong':
      return 'i-heroicons-bolt'
    case 'opportunity':
      return 'i-heroicons-arrow-trending-up'
    default:
      return 'i-heroicons-arrow-trending-up'
  }
})

const badgeClass = computed(() => {
  const base = 'value-badge'
  switch (tier.value) {
    case 'exceptional':
      return `${base} value-badge--exceptional`
    case 'strong':
      return `${base} value-badge--strong`
    case 'opportunity':
      return `${base} value-badge--opportunity`
    default:
      return base
  }
})
</script>
