<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <div class="w-full max-w-md text-center">
      <template v-if="loading">
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-12 h-12 text-primary-500 mx-auto mb-4 animate-spin"
        />
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
          Confirming your sign in...
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          Please wait while we verify your credentials.
        </p>
      </template>

      <template v-else-if="error">
        <UIcon
          name="i-heroicons-exclamation-triangle"
          class="w-12 h-12 text-red-500 mx-auto mb-4"
        />
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white">Authentication Failed</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          {{ error }}
        </p>
        <UButton to="/login" class="mt-6"> Back to Sign In </UButton>
      </template>

      <template v-else>
        <UIcon name="i-heroicons-check-circle" class="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white">Sign in successful!</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">Redirecting you to the dashboard...</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
})

const user = useSupabaseUser()
const route = useRoute()

const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  // Wait a moment for the auth state to be processed by @nuxtjs/supabase
  await new Promise(resolve => setTimeout(resolve, 500))

  // Check for error in URL (OAuth errors)
  const errorDescription = route.query.error_description as string
  if (errorDescription) {
    error.value = errorDescription
    loading.value = false
    return
  }

  const errorCode = route.query.error as string
  if (errorCode) {
    error.value = `Authentication error: ${errorCode}`
    loading.value = false
    return
  }

  // Wait for user to be loaded
  let attempts = 0
  const maxAttempts = 10

  while (!user.value && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 300))
    attempts++
  }

  loading.value = false

  if (user.value) {
    // Successfully authenticated, redirect to home or saved destination
    const redirectTo = (route.query.redirect as string) || '/'
    await navigateTo(redirectTo)
  } else {
    error.value = 'Unable to verify your credentials. Please try signing in again.'
  }
})
</script>
