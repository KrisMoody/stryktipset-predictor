<template>
  <UModal v-model:open="isOpen" title="Invite User" :ui="{ content: 'sm:max-w-md' }">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Send an invitation email to a new user. They will receive a magic link to sign up.
        </p>

        <UFormField label="Email Address" name="email" :error="emailError">
          <UInput
            v-model="email"
            type="email"
            placeholder="user@example.com"
            class="w-full"
            :disabled="sending"
            @keyup.enter="sendInvite"
          />
        </UFormField>

        <UAlert v-if="successMessage" color="success" icon="i-heroicons-check-circle">
          <template #description>{{ successMessage }}</template>
        </UAlert>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" :disabled="sending" @click="close">
          {{ successMessage ? 'Close' : 'Cancel' }}
        </UButton>
        <UButton
          v-if="!successMessage"
          color="primary"
          icon="i-heroicons-paper-airplane"
          :loading="sending"
          :disabled="!email || !!emailError"
          @click="sendInvite"
        >
          Send Invite
        </UButton>
        <UButton v-else color="primary" icon="i-heroicons-user-plus" @click="reset">
          Invite Another
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const isOpen = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  invited: []
}>()

const toast = useToast()

// State
const email = ref('')
const sending = ref(false)
const emailError = ref('')
const successMessage = ref('')

// Validate email on change
watch(email, value => {
  emailError.value = ''
  if (value && !isValidEmail(value)) {
    emailError.value = 'Please enter a valid email address'
  }
})

// Reset when modal closes
watch(isOpen, open => {
  if (!open) {
    // Delay reset to allow closing animation
    setTimeout(reset, 300)
  }
})

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function reset() {
  email.value = ''
  emailError.value = ''
  successMessage.value = ''
}

function close() {
  isOpen.value = false
  if (successMessage.value) {
    emit('invited')
  }
}

async function sendInvite() {
  if (!email.value || emailError.value) return

  sending.value = true
  emailError.value = ''

  try {
    const response = await $fetch<{
      success: boolean
      message: string
      isResend?: boolean
    }>('/api/admin/users/invite', {
      method: 'POST',
      body: { email: email.value },
    })

    if (response.success) {
      successMessage.value = response.isResend
        ? `Invitation resent to ${email.value}`
        : `Invitation sent to ${email.value}`

      toast.add({
        title: response.isResend ? 'Invitation resent' : 'Invitation sent',
        description: successMessage.value,
        color: 'success',
      })
    }
  } catch (err: unknown) {
    const error = err as { data?: { message?: string }; message?: string }
    const message = error?.data?.message || error?.message || 'Failed to send invitation'

    if (message.includes('already exists')) {
      emailError.value = 'A user with this email already exists'
    } else {
      emailError.value = message
    }

    toast.add({
      title: 'Failed to send invitation',
      description: message,
      color: 'error',
    })
  } finally {
    sending.value = false
  }
}
</script>
