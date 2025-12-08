<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <UIcon
          name="i-heroicons-chart-bar-square"
          class="w-12 h-12 text-primary-500 mx-auto mb-4"
        />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Stryktipset AI Predictor</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">Sign in to access predictions</p>
      </div>

      <UCard>
        <!-- Magic Link Form -->
        <form @submit.prevent="handleMagicLink">
          <UFormField label="Email" name="email">
            <UInput
              v-model="email"
              type="email"
              placeholder="your@email.com"
              size="lg"
              class="w-full"
              :disabled="loading"
              required
            />
          </UFormField>

          <UButton
            type="submit"
            block
            size="lg"
            class="mt-4"
            :loading="loading"
            :disabled="!email || loading"
          >
            <UIcon name="i-heroicons-envelope" class="w-5 h-5 mr-2" />
            Send Magic Link
          </UButton>
        </form>

        <!-- Success Message -->
        <UAlert v-if="magicLinkSent" color="success" icon="i-heroicons-check-circle" class="mt-4">
          <template #title>Check your email</template>
          <template #description>
            We've sent a magic link to {{ email }}. Click the link to sign in.
          </template>
        </UAlert>

        <!-- Error Message -->
        <UAlert v-if="error" color="error" icon="i-heroicons-exclamation-triangle" class="mt-4">
          <template #title>Authentication Error</template>
          <template #description>{{ error }}</template>
        </UAlert>
      </UCard>

      <p class="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
        Access is restricted to authorized users only.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false, // No header/footer on login page
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const config = useRuntimeConfig()

const email = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const magicLinkSent = ref(false)

// Redirect if already logged in
watch(
  user,
  newUser => {
    if (newUser) {
      navigateTo('/')
    }
  },
  { immediate: true }
)

async function handleMagicLink() {
  if (!email.value) return

  loading.value = true
  error.value = null
  magicLinkSent.value = false

  try {
    // Use configured redirect URL or fall back to current origin
    const baseUrl = config.public.authRedirectUrl || window.location.origin
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.value,
      options: {
        emailRedirectTo: `${baseUrl}/confirm`,
      },
    })

    if (authError) {
      error.value = authError.message
    } else {
      magicLinkSent.value = true
    }
  } catch (e) {
    error.value = 'An unexpected error occurred. Please try again.'
    console.error('Magic link error:', e)
  } finally {
    loading.value = false
  }
}
</script>
