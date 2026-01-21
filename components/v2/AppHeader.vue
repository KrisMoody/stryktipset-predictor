<template>
  <header
    class="h-16 flex items-center justify-between px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"
  >
    <!-- Left: Menu toggle (mobile) or breadcrumb (desktop) -->
    <div class="flex items-center gap-4">
      <button
        v-if="isMobile"
        class="p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        aria-label="Open menu"
        @click="$emit('openMenu')"
      >
        <UIcon name="i-heroicons-bars-3" class="w-6 h-6" />
      </button>
      <button
        v-else
        class="p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        aria-label="Toggle sidebar"
        @click="$emit('toggleSidebar')"
      >
        <UIcon name="i-heroicons-bars-3" class="w-5 h-5" />
      </button>

      <!-- Breadcrumb -->
      <nav v-if="!isMobile && breadcrumbItems.length > 0" aria-label="Breadcrumb">
        <ol class="flex items-center gap-2 text-sm">
          <li v-for="(item, index) in breadcrumbItems" :key="index" class="flex items-center gap-2">
            <UIcon
              v-if="index > 0"
              name="i-heroicons-chevron-right"
              class="w-4 h-4 text-gray-400"
            />
            <NuxtLink
              v-if="item.to"
              :to="item.to"
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {{ item.label }}
            </NuxtLink>
            <span v-else class="text-gray-900 dark:text-white font-medium">
              {{ item.label }}
            </span>
          </li>
        </ol>
      </nav>
    </div>

    <!-- Center: Search / Command Palette Trigger -->
    <button
      class="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
      @click="$emit('openCommandPalette')"
    >
      <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
      <span>Search...</span>
      <kbd
        class="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600"
      >
        <span>{{ isMac ? '⌘' : 'Ctrl' }}</span>
        <span>K</span>
      </kbd>
    </button>

    <!-- Right: Actions -->
    <div class="flex items-center gap-2">
      <!-- Game Type Selector (compact) -->
      <UDropdownMenu :items="gameTypeItems">
        <UButton variant="ghost" size="sm" class="hidden sm:flex">
          <UIcon name="i-heroicons-trophy" class="w-4 h-4 mr-1" />
          {{ currentGameLabel }}
          <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 ml-1" />
        </UButton>
      </UDropdownMenu>

      <!-- Color Mode Toggle -->
      <UColorModeButton />

      <!-- Mobile Search -->
      <button
        v-if="isMobile"
        class="p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        aria-label="Search"
        @click="$emit('openCommandPalette')"
      >
        <UIcon name="i-heroicons-magnifying-glass" class="w-5 h-5" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  isMobile?: boolean
}>()

defineEmits<{
  toggleSidebar: []
  openMenu: []
  openCommandPalette: []
}>()

const route = useRoute()
const { breadcrumbItems } = useNavigation()

// Detect Mac for keyboard shortcut display
const isMac = ref(false)
onMounted(() => {
  isMac.value = navigator.platform.toUpperCase().indexOf('MAC') >= 0
})

// Game type from query or default
const currentGameType = computed(() => (route.query.gameType as string) || 'stryktipset')
const currentGameLabel = computed(() => {
  const labels: Record<string, string> = {
    stryktipset: 'Stryktipset',
    europatipset: 'Europatipset',
    topptipset: 'Topptipset',
  }
  return labels[currentGameType.value] || 'Stryktipset'
})

const gameTypeItems = computed(() => [
  [
    {
      label: 'Stryktipset',
      icon: currentGameType.value === 'stryktipset' ? 'i-heroicons-check' : undefined,
      onSelect: () => navigateTo({ query: { ...route.query, gameType: 'stryktipset' } }),
    },
    {
      label: 'Europatipset',
      icon: currentGameType.value === 'europatipset' ? 'i-heroicons-check' : undefined,
      onSelect: () => navigateTo({ query: { ...route.query, gameType: 'europatipset' } }),
    },
    {
      label: 'Topptipset',
      icon: currentGameType.value === 'topptipset' ? 'i-heroicons-check' : undefined,
      onSelect: () => navigateTo({ query: { ...route.query, gameType: 'topptipset' } }),
    },
  ],
])
</script>
