<template>
  <UModal v-model:open="isOpen" title="Manual Game Entry" :ui="{ content: 'sm:max-w-lg' }">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Manually enter game data for Match #{{ matchNumber }} in draw {{ drawNumber }} ({{
            gameType
          }}).
        </p>

        <UFormField label="Home Team" name="homeTeam" required>
          <UInput
            v-model="form.homeTeamName"
            placeholder="e.g., Manchester United"
            class="w-full"
            :disabled="saving"
          />
        </UFormField>

        <UFormField label="Away Team" name="awayTeam" required>
          <UInput
            v-model="form.awayTeamName"
            placeholder="e.g., Liverpool"
            class="w-full"
            :disabled="saving"
          />
        </UFormField>

        <UFormField label="League/Competition" name="league" required>
          <UInput
            v-model="form.leagueName"
            placeholder="e.g., Premier League"
            class="w-full"
            :disabled="saving"
          />
        </UFormField>

        <UFormField label="Country" name="country">
          <UInput
            v-model="form.countryName"
            placeholder="e.g., England"
            class="w-full"
            :disabled="saving"
          />
        </UFormField>

        <UFormField label="Start Time" name="startTime" required>
          <UInput
            v-model="form.startTime"
            type="datetime-local"
            class="w-full"
            :disabled="saving"
          />
        </UFormField>

        <UAlert v-if="error" color="error" icon="i-heroicons-exclamation-circle">
          <template #description>{{ error }}</template>
        </UAlert>

        <UAlert v-if="successMessage" color="success" icon="i-heroicons-check-circle">
          <template #description>{{ successMessage }}</template>
        </UAlert>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" :disabled="saving" @click="close"> Cancel </UButton>
        <UButton
          v-if="!successMessage"
          color="primary"
          icon="i-heroicons-plus"
          :loading="saving"
          :disabled="!isFormValid"
          @click="saveMatch"
        >
          Create Match
        </UButton>
        <UButton v-else color="primary" @click="close"> Done </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  drawId: number
  drawNumber: number
  matchNumber: number
  gameType: string
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  submitted: []
}>()

const toast = useToast()

// Form state
const form = ref({
  homeTeamName: '',
  awayTeamName: '',
  leagueName: '',
  countryName: '',
  startTime: '',
})

const saving = ref(false)
const error = ref('')
const successMessage = ref('')

// Form validation
const isFormValid = computed(() => {
  return (
    form.value.homeTeamName.trim() &&
    form.value.awayTeamName.trim() &&
    form.value.leagueName.trim() &&
    form.value.startTime
  )
})

// Reset when modal closes
watch(isOpen, open => {
  if (!open) {
    setTimeout(reset, 300)
  }
})

function reset() {
  form.value = {
    homeTeamName: '',
    awayTeamName: '',
    leagueName: '',
    countryName: '',
    startTime: '',
  }
  error.value = ''
  successMessage.value = ''
}

function close() {
  isOpen.value = false
  if (successMessage.value) {
    emit('submitted')
  }
}

async function saveMatch() {
  if (!isFormValid.value) return

  saving.value = true
  error.value = ''

  try {
    const response = await $fetch<{
      success: boolean
      message?: string
      error?: string
      matchId?: number
    }>(`/api/admin/draws/${props.drawId}/manual-match`, {
      method: 'POST',
      body: {
        matchNumber: props.matchNumber,
        homeTeamName: form.value.homeTeamName.trim(),
        awayTeamName: form.value.awayTeamName.trim(),
        leagueName: form.value.leagueName.trim(),
        countryName: form.value.countryName.trim() || undefined,
        startTime: new Date(form.value.startTime).toISOString(),
      },
    })

    if (response.success) {
      successMessage.value = response.message || 'Match created successfully'
      toast.add({
        title: 'Match created',
        description: `Match #${props.matchNumber} has been created`,
        color: 'success',
      })
    } else {
      error.value = response.error || 'Failed to create match'
    }
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string }; message?: string }
    error.value = fetchError?.data?.message || fetchError?.message || 'Failed to create match'

    toast.add({
      title: 'Error',
      description: error.value,
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>
