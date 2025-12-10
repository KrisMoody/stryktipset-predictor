<template>
  <UModal v-model:open="isOpen" title="Re-evaluate All Matches" :ui="{ content: 'sm:max-w-md' }">
    <template #body>
      <div class="space-y-4">
        <!-- Loading state -->
        <div v-if="loadingEstimate" class="flex justify-center py-4">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>

        <!-- Cost estimation -->
        <div v-else-if="costEstimate" class="space-y-4">
          <!-- Model selector -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
            <USelect
              v-model="selectedModel"
              :items="modelOptions"
              value-key="value"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{
                selectedModel === 'claude-opus-4-5'
                  ? 'Premium model with enhanced reasoning - best for high jackpot draws'
                  : 'Standard model - recommended for most draws'
              }}
            </p>
          </div>

          <!-- Batch mode toggle -->
          <div class="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <UCheckbox v-model="useBatchMode" />
            <div class="flex-1">
              <label
                class="text-sm font-medium text-blue-700 dark:text-blue-300 cursor-pointer"
                @click="useBatchMode = !useBatchMode"
              >
                Use Batch API (50% cheaper)
              </label>
              <p class="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                Results available within 24 hours. Best for non-urgent predictions.
              </p>
            </div>
          </div>

          <div class="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-4">
            <div class="text-sm text-warning-700 dark:text-warning-300 mb-2">Estimated Cost</div>
            <div class="text-2xl font-bold text-warning-600 dark:text-warning-400">
              ${{ effectiveCost.toFixed(4) }}
              <span
                v-if="useBatchMode"
                class="text-sm font-normal line-through text-warning-400 dark:text-warning-500 ml-2"
              >
                ${{ costEstimate.estimatedCost.toFixed(4) }}
              </span>
            </div>
            <div class="text-xs text-warning-600/70 dark:text-warning-400/70 mt-1">
              {{ costEstimate.matchCount }} matches &middot; ~{{
                formatTokens(costEstimate.estimatedInputTokens)
              }}
              input tokens &middot; ~{{ formatTokens(costEstimate.estimatedOutputTokens) }} output
              tokens
              <span v-if="useBatchMode" class="text-blue-600 dark:text-blue-400 font-medium">
                &middot; 50% batch discount
              </span>
            </div>
          </div>

          <p class="text-sm text-gray-600 dark:text-gray-400">
            This will {{ useBatchMode ? 'queue' : 're-evaluate' }} predictions for all
            {{ costEstimate.matchCount }} matches in this draw using
            {{ selectedModel === 'claude-opus-4-5' ? 'Claude Opus 4.5' : 'Claude Sonnet 4.5' }}.
            {{
              useBatchMode
                ? 'Results will be available within 24 hours.'
                : 'The actual cost may vary slightly based on match data complexity.'
            }}
          </p>

          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div class="flex items-start gap-2">
              <UIcon
                :name="useBatchMode ? 'i-heroicons-clock' : 'i-heroicons-information-circle'"
                class="w-4 h-4 text-gray-400 mt-0.5"
              />
              <p class="text-xs text-gray-500">
                <template v-if="useBatchMode">
                  Batch predictions are processed asynchronously. You can check the status in the
                  draw page after submission.
                </template>
                <template v-else>
                  All matches will be processed in parallel for faster completion. Existing
                  predictions will be preserved; new predictions will be added.
                </template>
              </p>
            </div>
          </div>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="text-center py-4">
          <UIcon
            name="i-heroicons-exclamation-circle"
            class="w-8 h-8 text-error-500 mx-auto mb-2"
          />
          <p class="text-sm text-error-600">
            {{ error }}
          </p>
        </div>

        <!-- Batch success message -->
        <div v-if="batchSuccess" class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p class="text-sm font-medium text-green-700 dark:text-green-300">
                Batch submitted successfully!
              </p>
              <p class="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
                Batch ID: {{ batchId }}
              </p>
              <p class="text-xs text-green-600/70 dark:text-green-400/70">
                Results will be available within 24 hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" :disabled="loading" @click="close">
          {{ batchSuccess ? 'Close' : 'Cancel' }}
        </UButton>
        <UButton
          v-if="!batchSuccess"
          color="warning"
          :loading="loading"
          :disabled="loadingEstimate || !!error"
          @click="handleConfirm"
        >
          <UIcon
            :name="useBatchMode ? 'i-heroicons-clock' : 'i-heroicons-arrow-path'"
            class="w-4 h-4 mr-1"
          />
          {{ useBatchMode ? 'Submit Batch' : 'Confirm Re-evaluation' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { CostEstimation, PredictionModel } from '~/types'

interface Props {
  modelValue: boolean
  drawNumber: number
  gameType?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirmed: []
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const costEstimate = ref<CostEstimation | null>(null)
const loadingEstimate = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const selectedModel = ref<PredictionModel>('claude-sonnet-4-5')
const useBatchMode = ref(false)
const batchSuccess = ref(false)
const batchId = ref<string | null>(null)

const modelOptions = [
  { label: 'Sonnet 4.5 (Standard)', value: 'claude-sonnet-4-5' },
  { label: 'Opus 4.5 (Premium ~5x cost)', value: 'claude-opus-4-5' },
]

// Calculate effective cost (with batch discount if applicable)
const effectiveCost = computed(() => {
  if (!costEstimate.value) return 0
  return useBatchMode.value
    ? costEstimate.value.estimatedCost * 0.5
    : costEstimate.value.estimatedCost
})

// Fetch cost estimate based on selected model
const fetchCostEstimate = async () => {
  loadingEstimate.value = true
  error.value = null
  try {
    costEstimate.value = await $fetch<CostEstimation>(
      `/api/draws/${props.drawNumber}/estimate-cost`,
      { query: { model: selectedModel.value, gameType: props.gameType || 'stryktipset' } }
    )
  } catch (e) {
    error.value = 'Failed to estimate cost. Please try again.'
    console.error('Cost estimation failed:', e)
  } finally {
    loadingEstimate.value = false
  }
}

// Fetch cost estimate when modal opens
watch(isOpen, async open => {
  if (open) {
    selectedModel.value = 'claude-sonnet-4-5' // Reset to default
    useBatchMode.value = false
    batchSuccess.value = false
    batchId.value = null
    await fetchCostEstimate()
  }
})

// Re-fetch cost estimate when model changes
watch(selectedModel, async () => {
  if (isOpen.value) {
    await fetchCostEstimate()
  }
})

const close = () => {
  isOpen.value = false
}

const handleConfirm = async () => {
  loading.value = true
  error.value = null

  try {
    if (useBatchMode.value) {
      // Submit batch request
      const response = await $fetch<{ batchId: string }>(
        `/api/draws/${props.drawNumber}/batch-predict`,
        {
          method: 'POST',
          body: { model: selectedModel.value, gameType: props.gameType || 'stryktipset' },
        }
      )
      batchId.value = response.batchId
      batchSuccess.value = true
      emit('confirmed')
    } else {
      // Immediate re-evaluation
      await $fetch(`/api/draws/${props.drawNumber}/reevaluate-all`, {
        method: 'POST',
        body: { model: selectedModel.value, gameType: props.gameType || 'stryktipset' },
      })
      emit('confirmed')
      close()
    }
  } catch (e) {
    error.value = useBatchMode.value
      ? 'Failed to submit batch. Please try again.'
      : 'Re-evaluation failed. Please try again.'
    console.error('Request failed:', e)
  } finally {
    loading.value = false
  }
}

const formatTokens = (tokens: number) => {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`
  }
  return tokens.toString()
}
</script>
