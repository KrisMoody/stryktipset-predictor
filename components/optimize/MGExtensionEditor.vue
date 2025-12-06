<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">
          MG Extensions (Optional)
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Expand your coupon by adding extra hedges to specific matches
        </p>
      </div>
      <UBadge
        v-if="extensions.length > 0"
        color="primary"
        variant="soft"
      >
        {{ extensions.length }} extension{{ extensions.length > 1 ? 's' : '' }}
      </UBadge>
    </div>

    <!-- Cost Impact Summary -->
    <UCard v-if="extensions.length > 0">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            Row Multiplier
          </div>
          <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
            × {{ totalMultiplier }}
          </div>
        </div>
        <div class="text-right">
          <div class="text-sm text-gray-600 dark:text-gray-400">
            New Total Rows
          </div>
          <div class="text-2xl font-bold">
            {{ baseRows }} → {{ baseRows * totalMultiplier }}
          </div>
        </div>
        <div class="text-right">
          <div class="text-sm text-gray-600 dark:text-gray-400">
            New Cost
          </div>
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">
            {{ baseRows * totalMultiplier }} SEK
          </div>
        </div>
      </div>
    </UCard>

    <!-- Available Matches for MG -->
    <div class="space-y-3">
      <UCard
        v-for="match in availableMatches"
        :key="match.matchNumber"
        :class="getMatchExtensionStatus(match.matchNumber) ? 'border-primary-500 border-2' : ''"
      >
        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex-1 min-w-[200px]">
            <div class="font-semibold text-sm">
              {{ match.matchNumber }}. {{ match.homeTeam }} - {{ match.awayTeam }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              Current: {{ getCurrentCoverage(match.matchNumber) }}
            </div>
          </div>

          <div class="flex items-center gap-3">
            <!-- MG Type Selection -->
            <UButtonGroup size="sm">
              <UButton
                :variant="!getMatchExtensionStatus(match.matchNumber) ? 'solid' : 'outline'"
                :color="!getMatchExtensionStatus(match.matchNumber) ? 'neutral' : 'neutral'"
                @click="removeExtension(match.matchNumber)"
              >
                None
              </UButton>
              <UButton
                v-if="canApplyHalv(match.matchNumber)"
                :variant="getMatchExtensionType(match.matchNumber) === 'halv' ? 'solid' : 'outline'"
                :color="getMatchExtensionType(match.matchNumber) === 'halv' ? 'primary' : 'neutral'"
                @click="setExtension(match.matchNumber, 'halv')"
              >
                MG-halv (×2)
              </UButton>
              <UButton
                v-if="canApplyHel(match.matchNumber)"
                :variant="getMatchExtensionType(match.matchNumber) === 'hel' ? 'solid' : 'outline'"
                :color="getMatchExtensionType(match.matchNumber) === 'hel' ? 'primary' : 'neutral'"
                @click="setExtension(match.matchNumber, 'hel')"
              >
                MG-hel (×3)
              </UButton>
            </UButtonGroup>
          </div>
        </div>

        <!-- Halv outcomes selection -->
        <div
          v-if="getMatchExtensionType(match.matchNumber) === 'halv'"
          class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
        >
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Select which outcome to add:
          </div>
          <UButtonGroup size="sm">
            <UButton
              v-for="outcome in getMissingOutcomes(match.matchNumber)"
              :key="outcome"
              :variant="isHalvOutcomeSelected(match.matchNumber, outcome) ? 'solid' : 'outline'"
              :color="isHalvOutcomeSelected(match.matchNumber, outcome) ? 'primary' : 'neutral'"
              @click="toggleHalvOutcome(match.matchNumber, outcome)"
            >
              {{ outcome }}
            </UButton>
          </UButtonGroup>
        </div>
      </UCard>
    </div>

    <!-- Info Alert -->
    <UAlert
      color="info"
      variant="soft"
      icon="i-heroicons-information-circle"
      title="About MG Extensions"
      description="MG-hel adds all 3 outcomes (×3 rows). MG-halv adds one more outcome (×2 rows). Extensions can only be applied to matches that aren't already fully hedged."
    />
  </div>
</template>

<script setup lang="ts">
import type { BettingSystem, CouponSelection, MGExtension } from '~/types'

const props = defineProps<{
  system: BettingSystem
  aiPredictions: CouponSelection[]
  currentCoverage: Record<number, string[]> // matchNumber -> outcomes covered
  extensions?: MGExtension[]
}>()

const emit = defineEmits<{
  update: [extensions: MGExtension[]]
}>()

// Internal state
const extensions = ref<MGExtension[]>(props.extensions || [])

// Watch for external updates
watch(() => props.extensions, (newVal) => {
  if (newVal) {
    extensions.value = [...newVal]
  }
}, { deep: true })

// Computed
const baseRows = computed(() => props.system.rows)

const totalMultiplier = computed(() => {
  return extensions.value.reduce((mult, ext) => {
    return mult * (ext.type === 'hel' ? 3 : 2)
  }, 1)
})

// Matches that can have MG extensions (not already fully hedged)
const availableMatches = computed(() => {
  return props.aiPredictions.filter((match) => {
    const coverage = props.currentCoverage[match.matchNumber] || []
    // Can apply MG if not already covering all 3 outcomes
    return coverage.length < 3
  })
})

// Methods
const getCurrentCoverage = (matchNumber: number): string => {
  const coverage = props.currentCoverage[matchNumber] || []
  if (coverage.length === 0) return 'Spik'
  if (coverage.length === 1) return `Spik (${coverage[0]})`
  if (coverage.length === 2) return `Halvgarderad (${coverage.join(', ')})`
  return 'Helgarderad'
}

const getMatchExtensionStatus = (matchNumber: number): MGExtension | undefined => {
  return extensions.value.find(e => e.matchNumber === matchNumber)
}

const getMatchExtensionType = (matchNumber: number): 'hel' | 'halv' | null => {
  const ext = getMatchExtensionStatus(matchNumber)
  return ext?.type || null
}

const canApplyHel = (matchNumber: number): boolean => {
  const coverage = props.currentCoverage[matchNumber] || []
  // Can apply MG-hel if covering less than 3 outcomes
  return coverage.length < 3
}

const canApplyHalv = (matchNumber: number): boolean => {
  const coverage = props.currentCoverage[matchNumber] || []
  // Can apply MG-halv if covering exactly 1 or 2 outcomes (to add one more)
  return coverage.length >= 1 && coverage.length < 3
}

const getMissingOutcomes = (matchNumber: number): string[] => {
  const coverage = props.currentCoverage[matchNumber] || []
  const allOutcomes = ['1', 'X', '2']
  return allOutcomes.filter(o => !coverage.includes(o))
}

const setExtension = (matchNumber: number, type: 'hel' | 'halv') => {
  // Remove existing extension for this match
  const filtered = extensions.value.filter(e => e.matchNumber !== matchNumber)

  if (type === 'hel') {
    // MG-hel doesn't need specific outcomes
    filtered.push({ matchNumber, type: 'hel' })
  }
  else {
    // MG-halv needs outcomes to be selected
    const missingOutcomes = getMissingOutcomes(matchNumber)
    // Default to first missing outcome
    const outcomes: string[] = missingOutcomes.length > 0 && missingOutcomes[0] ? [missingOutcomes[0]] : []
    filtered.push({
      matchNumber,
      type: 'halv',
      outcomes,
    })
  }

  extensions.value = filtered
  emit('update', filtered)
}

const removeExtension = (matchNumber: number) => {
  extensions.value = extensions.value.filter(e => e.matchNumber !== matchNumber)
  emit('update', extensions.value)
}

const isHalvOutcomeSelected = (matchNumber: number, outcome: string): boolean => {
  const ext = getMatchExtensionStatus(matchNumber)
  return ext?.type === 'halv' && (ext.outcomes?.includes(outcome) || false)
}

const toggleHalvOutcome = (matchNumber: number, outcome: string) => {
  const extIndex = extensions.value.findIndex(e => e.matchNumber === matchNumber)
  if (extIndex === -1) return

  const ext = extensions.value[extIndex]
  if (!ext || ext.type !== 'halv') return

  // For halv, we only select ONE additional outcome
  extensions.value[extIndex] = {
    matchNumber: ext.matchNumber,
    type: ext.type,
    outcomes: [outcome],
  }

  emit('update', [...extensions.value])
}
</script>
