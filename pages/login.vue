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

        <!-- Divider -->
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300 dark:border-gray-700" />
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white dark:bg-gray-800 text-gray-500"> Or continue with </span>
          </div>
        </div>

        <!-- OAuth Providers -->
        <div class="space-y-3">
          <UButton
            block
            size="lg"
            variant="outline"
            :loading="loadingProvider === 'google'"
            :disabled="loading"
            @click="handleOAuth('google')"
          >
            <UIcon name="i-lucide-mail" class="w-5 h-5 mr-2" />
            Continue with Google
          </UButton>

          <UButton
            block
            size="lg"
            variant="outline"
            :loading="loadingProvider === 'github'"
            :disabled="loading"
            @click="handleOAuth('github')"
          >
            <UIcon name="i-lucide-github" class="w-5 h-5 mr-2" />
            Continue with GitHub
          </UButton>
        </div>

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

const email = ref('')
const loading = ref(false)
const loadingProvider = ref<string | null>(null)
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
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.value,
      options: {
        emailRedirectTo: `${window.location.origin}/confirm`,
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

async function handleOAuth(provider: 'google' | 'github') {
  loadingProvider.value = provider
  error.value = null

  try {
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/confirm`,
      },
    })

    if (authError) {
      error.value = authError.message
    }
  } catch (e) {
    error.value = 'An unexpected error occurred. Please try again.'
    console.error('OAuth error:', e)
  } finally {
    loadingProvider.value = null
  }
}
</script>
