<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <a href="#main-content" class="skip-link">Hoppa till huvudinnehåll</a>

    <!-- Desktop/Tablet Layout -->
    <div class="hidden md:flex h-screen overflow-hidden">
      <!-- Sidebar -->
      <V2AppSidebar :collapsed="sidebarCollapsed" @toggle="sidebarCollapsed = !sidebarCollapsed" />

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Header -->
        <V2AppHeader
          @toggle-sidebar="sidebarCollapsed = !sidebarCollapsed"
          @open-command-palette="commandPaletteOpen = true"
        />

        <!-- Main Content -->
        <main id="main-content" class="flex-1 overflow-y-auto">
          <slot />
        </main>
      </div>
    </div>

    <!-- Mobile Layout -->
    <div class="md:hidden flex flex-col min-h-screen">
      <!-- Mobile Header -->
      <V2AppHeader
        :is-mobile="true"
        @open-menu="mobileMenuOpen = true"
        @open-command-palette="commandPaletteOpen = true"
      />

      <!-- Main Content -->
      <main id="main-content" class="flex-1 pb-16">
        <slot />
      </main>

      <!-- Mobile Bottom Navigation -->
      <V2MobileBottomNav />

      <!-- Mobile Menu Overlay -->
      <Transition name="slide-left">
        <div
          v-if="mobileMenuOpen"
          class="fixed inset-0 z-50 flex"
          @click.self="mobileMenuOpen = false"
        >
          <div class="absolute inset-0 bg-black/50" @click="mobileMenuOpen = false" />
          <div class="relative w-72 bg-white dark:bg-gray-900 h-full shadow-xl">
            <V2AppSidebar :collapsed="false" :is-mobile="true" @close="mobileMenuOpen = false" />
          </div>
        </div>
      </Transition>
    </div>

    <!-- Command Palette -->
    <V2CommandPalette v-model:open="commandPaletteOpen" />
  </div>
</template>

<script setup lang="ts">
const sidebarCollapsed = ref(false)
const mobileMenuOpen = ref(false)
const commandPaletteOpen = ref(false)

// Keyboard shortcut for command palette
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      commandPaletteOpen.value = !commandPaletteOpen.value
    }
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
})
</script>

<style scoped>
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  opacity: 0;
}

.slide-left-enter-from > div:last-child,
.slide-left-leave-to > div:last-child {
  transform: translateX(-100%);
}
</style>
