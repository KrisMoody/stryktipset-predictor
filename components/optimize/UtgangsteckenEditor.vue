<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">Set Utgångstecken</h3>
      <UButton variant="outline" size="sm" icon="i-heroicons-sparkles" @click="autoFillFromAI">
        Auto-fill from AI
      </UButton>
    </div>

    <div class="space-y-3">
      <UCard v-for="match in hedgedMatches" :key="match.matchNumber">
        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex-1 min-w-[200px]">
            <div class="font-semibold text-sm">
              {{ match.matchNumber }}. {{ match.homeTeam }} - {{ match.awayTeam }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              EV: {{ match.expected_value.toFixed(1) }}%
            </div>
          </div>

          <div class="flex items-center gap-3">
            <UFieldGroup size="md">
              <UButton
                v-for="outcome in ['1', 'X', '2']"
                :key="outcome"
                :variant="
                  selectedUtgangstecken[match.matchNumber] === outcome ? 'solid' : 'outline'
                "
                :color="
                  selectedUtgangstecken[match.matchNumber] === outcome ? 'primary' : 'neutral'
                "
                @click="setUtgangstecken(match.matchNumber, outcome)"
              >
                {{ outcome }}
              </UButton>
            </UFieldGroup>

            <UBadge v-if="aiSuggestion(match)" variant="soft" color="info" size="sm">
              AI: {{ aiSuggestion(match) }}
            </UBadge>
          </div>
        </div>
      </UCard>
    </div>

    <div v-if="Object.keys(selectedUtgangstecken).length < requiredCount" class="mt-4">
      <UAlert
        color="warning"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        title="Incomplete Selection"
        :description="`Please select utgångstecken for all ${requiredCount} hedged matches. ${Object.keys(selectedUtgangstecken).length}/${requiredCount} selected.`"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BettingSystem, CouponSelection } from '~/types'

const props = defineProps<{
  system: BettingSystem
  aiPredictions: CouponSelection[]
  utgangstecken?: Record<number, string>
}>()

const emit = defineEmits<{
  update: [utgangstecken: Record<number, string>]
}>()

// Internal state
const selectedUtgangstecken = ref<Record<number, string>>(props.utgangstecken || {})

// Watch for external updates
watch(
  () => props.utgangstecken,
  newVal => {
    if (newVal) {
      selectedUtgangstecken.value = { ...newVal }
    }
  },
  { deep: true }
)

// Computed
const requiredCount = computed(() => {
  return props.system.helgarderingar + props.system.halvgarderingar
})

// Determine which matches are hedged (not spiks)
// For simplicity, we hedge the matches with lowest EVs (most uncertain)
const hedgedMatches = computed(() => {
  const sorted = [...props.aiPredictions].sort((a, b) => a.expected_value - b.expected_value)
  return sorted.slice(0, requiredCount.value)
})

// Methods
const setUtgangstecken = (matchNumber: number, outcome: string) => {
  selectedUtgangstecken.value[matchNumber] = outcome
  emit('update', { ...selectedUtgangstecken.value })
}

const aiSuggestion = (match: CouponSelection): string => {
  // Return the AI's top prediction
  return match.selection.length === 1 ? match.selection : match.selection[0] || '1'
}

const autoFillFromAI = () => {
  const newUtgangstecken: Record<number, string> = {}
  hedgedMatches.value.forEach(match => {
    newUtgangstecken[match.matchNumber] = aiSuggestion(match)
  })
  selectedUtgangstecken.value = newUtgangstecken
  emit('update', newUtgangstecken)
}

// Auto-fill on mount if empty
onMounted(() => {
  if (Object.keys(selectedUtgangstecken.value).length === 0) {
    autoFillFromAI()
  }
})
</script>
