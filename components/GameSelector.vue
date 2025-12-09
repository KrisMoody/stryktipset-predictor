<template>
  <div class="flex items-center gap-2">
    <label v-if="showLabel" :for="inputId" class="text-sm text-gray-600 dark:text-gray-400">
      Game:
    </label>
    <USelect :id="inputId" v-model="selectedGameLabel" :items="gameLabels" class="w-48" />
  </div>
</template>

<script setup lang="ts">
import type { GameType } from '~/types/game-types'

interface Props {
  modelValue?: GameType
  showLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 'stryktipset',
  showLabel: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: GameType]
  change: [value: GameType]
}>()

const inputId = useId()

// Game options mapping
const gameMap: Record<string, GameType> = {
  Stryktipset: 'stryktipset',
  Europatipset: 'europatipset',
  Topptipset: 'topptipset',
}

const labelMap: Record<GameType, string> = {
  stryktipset: 'Stryktipset',
  europatipset: 'Europatipset',
  topptipset: 'Topptipset',
}

// Simple string array for USelect
const gameLabels = ['Stryktipset', 'Europatipset', 'Topptipset']

const selectedGameLabel = ref(labelMap[props.modelValue])

// Sync with prop changes
watch(
  () => props.modelValue,
  newValue => {
    selectedGameLabel.value = labelMap[newValue]
  }
)

// Emit changes when selection changes
watch(selectedGameLabel, newLabel => {
  const gameType = gameMap[newLabel]
  if (gameType && gameType !== props.modelValue) {
    emit('update:modelValue', gameType)
    emit('change', gameType)
  }
})
</script>
