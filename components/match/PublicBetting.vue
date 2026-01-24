<template>
  <div v-if="hasData" class="space-y-1">
    <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
      <UIcon name="i-heroicons-users" class="w-3 h-3" />
      Svenska Folket
    </div>
    <!-- Stacked Bar -->
    <div class="flex h-6 rounded overflow-hidden text-xs font-medium">
      <div
        v-for="segment in segments"
        :key="segment.label"
        class="flex items-center justify-center transition-all"
        :class="segment.colorClass"
        :style="{ width: segment.width }"
      >
        <span v-if="segment.percent >= 15" class="text-white drop-shadow-sm">
          {{ segment.label }} {{ segment.percent }}%
        </span>
      </div>
    </div>
    <!-- Labels for small segments -->
    <div v-if="hasSmallSegments" class="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
      <span v-for="segment in smallSegments" :key="segment.label">
        {{ segment.label }}: {{ segment.percent }}%
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface PublicBettingData {
  home: string | number | null | undefined
  draw: string | number | null | undefined
  away: string | number | null | undefined
}

const props = defineProps<{
  betting: PublicBettingData | null | undefined
}>()

const hasData = computed(() => {
  if (!props.betting) return false
  const home = parseFloat(String(props.betting.home || '0'))
  const draw = parseFloat(String(props.betting.draw || '0'))
  const away = parseFloat(String(props.betting.away || '0'))
  return home > 0 || draw > 0 || away > 0
})

const segments = computed(() => {
  const betting = props.betting
  const home = parseFloat(String(betting?.home || '0'))
  const draw = parseFloat(String(betting?.draw || '0'))
  const away = parseFloat(String(betting?.away || '0'))
  const total = home + draw + away || 100

  return [
    {
      label: '1',
      percent: Math.round((home / total) * 100),
      width: `${(home / total) * 100}%`,
      colorClass: 'bg-blue-500',
    },
    {
      label: 'X',
      percent: Math.round((draw / total) * 100),
      width: `${(draw / total) * 100}%`,
      colorClass: 'bg-gray-500',
    },
    {
      label: '2',
      percent: Math.round((away / total) * 100),
      width: `${(away / total) * 100}%`,
      colorClass: 'bg-red-500',
    },
  ]
})

const smallSegments = computed(() => segments.value.filter(s => s.percent < 15 && s.percent > 0))

const hasSmallSegments = computed(() => smallSegments.value.length > 0)
</script>
