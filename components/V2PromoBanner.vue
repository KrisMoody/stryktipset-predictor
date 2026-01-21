<template>
  <Transition name="slide-down">
    <div
      v-if="showV2Banner"
      class="bg-gradient-to-r from-primary-600 to-primary-500 text-white px-4 py-3"
    >
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-sparkles" class="w-5 h-5 flex-shrink-0" />
          <p class="text-sm font-medium">
            Try the new redesigned UI with improved navigation and match cards!
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="solid"
            size="sm"
            class="bg-white text-primary-600 hover:bg-gray-100"
            @click="enableV2"
          >
            Try New UI
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            class="text-white hover:bg-white/20"
            @click="dismissBanner"
          >
            Maybe Later
          </UButton>
          <button
            class="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Dismiss"
            @click="dismissBanner"
          >
            <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { showV2Banner, setPreference, dismissBanner } = useUIVersion()

function enableV2() {
  setPreference('v2')
  // Navigate to V2 dashboard
  navigateTo('/v2')
}
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
