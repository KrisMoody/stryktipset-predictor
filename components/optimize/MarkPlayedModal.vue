<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
              <UIcon
                name="i-heroicons-clipboard-document-check"
                class="w-6 h-6 text-primary-600 dark:text-primary-400"
              />
            </div>
            <div>
              <h3 class="text-lg font-semibold">
                Mark Coupon as Played?
              </h3>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-gray-600 dark:text-gray-400">
            You just {{ actionType === 'copy' ? 'copied' : 'downloaded' }} this coupon.
            Would you like to mark it as <strong>"played"</strong>?
          </p>

          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-400">
            <p class="font-medium text-gray-900 dark:text-gray-100 mb-1">
              Why mark as played?
            </p>
            <ul class="list-disc list-inside space-y-1">
              <li>Track which coupons you actually submitted</li>
              <li>Analyze performance after the draw completes</li>
              <li>Compare your ROI over time</li>
            </ul>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton
              variant="ghost"
              :disabled="loading"
              @click="handleSkip"
            >
              Skip
            </UButton>
            <UButton
              color="primary"
              :loading="loading"
              @click="handleMarkPlayed"
            >
              <UIcon
                name="i-heroicons-check-circle"
                class="w-4 h-4 mr-1"
              />
              Mark as Played
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  couponId: number
  actionType: 'copy' | 'download'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'completed': [markedPlayed: boolean]
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const loading = ref(false)

const close = () => {
  isOpen.value = false
}

const handleSkip = () => {
  emit('completed', false)
  close()
}

const handleMarkPlayed = async () => {
  loading.value = true
  try {
    await $fetch(`/api/coupons/${props.couponId}/status`, {
      method: 'PATCH',
      body: { status: 'played' },
    })
    emit('completed', true)
    close()
  }
  catch (error) {
    console.error('Failed to mark coupon as played:', error)
    emit('completed', false)
    close()
  }
  finally {
    loading.value = false
  }
}
</script>
