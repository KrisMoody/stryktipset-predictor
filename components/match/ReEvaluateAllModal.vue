<template>
  <UModal
    v-model:open="isOpen"
    title="Re-evaluate All Matches"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Loading state -->
        <div
          v-if="loadingEstimate"
          class="flex justify-center py-4"
        >
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>

        <!-- Cost estimation -->
        <div
          v-else-if="costEstimate"
          class="space-y-4"
        >
          <div class="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-4">
            <div class="text-sm text-warning-700 dark:text-warning-300 mb-2">
              Estimated Cost
            </div>
            <div class="text-2xl font-bold text-warning-600 dark:text-warning-400">
              ${{ costEstimate.estimatedCost.toFixed(4) }}
            </div>
            <div class="text-xs text-warning-600/70 dark:text-warning-400/70 mt-1">
              {{ costEstimate.matchCount }} matches &middot;
              ~{{ formatTokens(costEstimate.estimatedInputTokens) }} input tokens &middot;
              ~{{ formatTokens(costEstimate.estimatedOutputTokens) }} output tokens
            </div>
          </div>

          <p class="text-sm text-gray-600 dark:text-gray-400">
            This will re-evaluate predictions for all {{ costEstimate.matchCount }} matches
            in this draw using Claude Sonnet 4.5. The actual cost may vary slightly
            based on match data complexity.
          </p>

          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div class="flex items-start gap-2">
              <UIcon
                name="i-heroicons-information-circle"
                class="w-4 h-4 text-gray-400 mt-0.5"
              />
              <p class="text-xs text-gray-500">
                All matches will be processed in parallel for faster completion.
                Existing predictions will be preserved; new predictions will be added.
              </p>
            </div>
          </div>
        </div>

        <!-- Error state -->
        <div
          v-else-if="error"
          class="text-center py-4"
        >
          <UIcon
            name="i-heroicons-exclamation-circle"
            class="w-8 h-8 text-error-500 mx-auto mb-2"
          />
          <p class="text-sm text-error-600">
            {{ error }}
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton
          variant="ghost"
          :disabled="loading"
          @click="close"
        >
          Cancel
        </UButton>
        <UButton
          color="warning"
          :loading="loading"
          :disabled="loadingEstimate || !!error"
          @click="handleConfirm"
        >
          <UIcon
            name="i-heroicons-arrow-path"
            class="w-4 h-4 mr-1"
          />
          Confirm Re-evaluation
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { CostEstimation } from '~/server/api/draws/[drawNumber]/estimate-cost.get'

interface Props {
  modelValue: boolean
  drawNumber: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirmed': []
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const costEstimate = ref<CostEstimation | null>(null)
const loadingEstimate = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

// Fetch cost estimate when modal opens
watch(isOpen, async (open) => {
  if (open) {
    loadingEstimate.value = true
    error.value = null
    try {
      costEstimate.value = await $fetch<CostEstimation>(
        `/api/draws/${props.drawNumber}/estimate-cost`,
      )
    }
    catch (e) {
      error.value = 'Failed to estimate cost. Please try again.'
      console.error('Cost estimation failed:', e)
    }
    finally {
      loadingEstimate.value = false
    }
  }
})

const close = () => {
  isOpen.value = false
}

const handleConfirm = async () => {
  loading.value = true
  error.value = null
  try {
    await $fetch(`/api/draws/${props.drawNumber}/reevaluate-all`, {
      method: 'POST',
    })
    emit('confirmed')
    close()
  }
  catch (e) {
    error.value = 'Re-evaluation failed. Please try again.'
    console.error('Re-evaluation failed:', e)
  }
  finally {
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
