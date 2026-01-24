<template>
  <div v-if="hasData" class="space-y-1">
    <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
      <UIcon name="i-heroicons-newspaper" class="w-3 h-3" />
      Tio Tidningars Tips
    </div>
    <div class="flex gap-2">
      <div
        v-for="outcome in outcomes"
        :key="outcome.label"
        class="flex items-center gap-1 px-2 py-1 rounded text-xs"
        :class="getBadgeClass(outcome.value)"
      >
        <span class="font-medium">{{ outcome.label }}</span>
        <span class="font-bold">{{ outcome.value }}/10</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ExpertTips {
  home: string | number | null | undefined
  draw: string | number | null | undefined
  away: string | number | null | undefined
}

const props = defineProps<{
  tips: ExpertTips | null | undefined
}>()

const hasData = computed(() => {
  if (!props.tips) return false
  return props.tips.home || props.tips.draw || props.tips.away
})

const outcomes = computed(() => {
  const tips = props.tips
  return [
    { label: '1', value: parseInt(String(tips?.home || '0')) },
    { label: 'X', value: parseInt(String(tips?.draw || '0')) },
    { label: '2', value: parseInt(String(tips?.away || '0')) },
  ]
})

function getBadgeClass(value: number): string {
  const base = 'transition-colors'
  if (value >= 7) {
    return `${base} bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400`
  }
  if (value >= 4) {
    return `${base} bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400`
  }
  return `${base} bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`
}
</script>
