<template>
  <div class="flex items-center gap-2">
    <label v-if="showLabel" class="text-sm text-gray-600 dark:text-gray-400"> Stake: </label>
    <UButtonGroup>
      <UButton
        v-for="stake in stakes"
        :key="stake"
        :color="selectedStake === stake ? 'primary' : 'neutral'"
        :variant="selectedStake === stake ? 'solid' : 'outline'"
        size="sm"
        @click="selectStake(stake)"
      >
        {{ stake }} SEK
      </UButton>
    </UButtonGroup>
  </div>
</template>

<script setup lang="ts">
type TopptipsetStake = 1 | 2 | 5 | 10

interface Props {
  modelValue?: TopptipsetStake
  showLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 1,
  showLabel: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: TopptipsetStake]
  change: [value: TopptipsetStake]
}>()

const stakes: TopptipsetStake[] = [1, 2, 5, 10]

const selectedStake = ref<TopptipsetStake>(props.modelValue)

// Sync with prop changes
watch(
  () => props.modelValue,
  newValue => {
    selectedStake.value = newValue
  }
)

function selectStake(stake: TopptipsetStake) {
  selectedStake.value = stake
  emit('update:modelValue', stake)
  emit('change', stake)
}
</script>
