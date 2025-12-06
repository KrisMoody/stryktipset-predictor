<template>
  <UModal v-model:open="isOpen" title="Re-evaluate Prediction" :ui="{ content: 'sm:max-w-xl' }">
    <template #body>
      <div class="space-y-4">
        <!-- Match Info -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">Match</div>
          <div class="font-semibold">{{ homeTeam }} vs {{ awayTeam }}</div>
        </div>

        <!-- Current Prediction (if exists) -->
        <div v-if="currentPrediction" class="space-y-2">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300">Current Prediction</div>
          <div class="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
            <div class="flex items-center gap-3">
              <span class="text-xl font-bold text-primary-600 dark:text-primary-400">
                {{ currentPrediction.predicted_outcome }}
              </span>
              <UBadge :color="getConfidenceColor(currentPrediction.confidence)" variant="subtle">
                {{ currentPrediction.confidence }}
              </UBadge>
            </div>
            <div class="flex gap-3 text-xs mt-2 text-gray-600 dark:text-gray-400">
              <span>1: {{ formatProb(currentPrediction.probability_home) }}%</span>
              <span>X: {{ formatProb(currentPrediction.probability_draw) }}%</span>
              <span>2: {{ formatProb(currentPrediction.probability_away) }}%</span>
            </div>
            <div
              v-if="currentPrediction.user_context"
              class="mt-2 pt-2 border-t border-primary-200 dark:border-primary-800"
            >
              <div class="text-xs text-gray-500">Previous context:</div>
              <div class="text-xs text-gray-600 dark:text-gray-400 italic">
                "{{ currentPrediction.user_context }}"
              </div>
            </div>
          </div>
        </div>

        <!-- Context Input -->
        <div class="space-y-2">
          <label
            for="reevaluation-context"
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Additional Context
          </label>
          <UTextarea
            id="reevaluation-context"
            v-model="userContext"
            placeholder="Add context to influence the prediction (e.g., 'Star striker injured', 'Home team missing 3 key defenders', 'Derby match with high emotions')"
            :rows="4"
            :disabled="loading"
            aria-describedby="reevaluation-context-help"
          />
          <p id="reevaluation-context-help" class="text-xs text-gray-500">
            This context will be included in the AI prompt to help generate a more accurate
            prediction.
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" :disabled="loading" @click="close"> Cancel </UButton>
        <UButton color="primary" :loading="loading" @click="handleReEvaluate">
          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-1" />
          Re-evaluate
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface CurrentPrediction {
  predicted_outcome: string
  confidence: string
  probability_home: number
  probability_draw: number
  probability_away: number
  reasoning?: string
  user_context?: string
}

interface Props {
  modelValue: boolean
  matchId: number
  homeTeam: string
  awayTeam: string
  currentPrediction?: CurrentPrediction | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  reevaluated: []
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const userContext = ref('')
const loading = ref(false)

const close = () => {
  isOpen.value = false
  userContext.value = ''
}

const handleReEvaluate = async () => {
  loading.value = true
  try {
    await $fetch(`/api/matches/${props.matchId}/predict`, {
      method: 'POST',
      body: {
        context: userContext.value.trim() || undefined,
        isReevaluation: true,
      },
    })
    emit('reevaluated')
    close()
  } catch (error) {
    console.error('Re-evaluation failed:', error)
  } finally {
    loading.value = false
  }
}

const formatProb = (prob: number) => (Number(prob) * 100).toFixed(1)

const getConfidenceColor = (confidence: string) => {
  switch (confidence) {
    case 'high':
      return 'success'
    case 'medium':
      return 'warning'
    case 'low':
      return 'error'
    default:
      return 'neutral'
  }
}
</script>
