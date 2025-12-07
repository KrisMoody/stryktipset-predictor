<template>
  <header
    class="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800"
  >
    <UContainer>
      <div class="flex items-center justify-between h-16">
        <!-- Logo/Brand -->
        <NuxtLink
          to="/"
          class="flex items-center gap-2 font-bold text-lg"
          aria-label="Stryktipset AI - Hem"
        >
          <UIcon
            name="i-heroicons-chart-bar-square"
            class="w-6 h-6 text-primary-500"
            aria-hidden="true"
          />
          <span class="hidden sm:inline">Stryktipset AI</span>
        </NuxtLink>

        <!-- Desktop Navigation -->
        <nav class="hidden md:flex items-center gap-1" aria-label="Huvudnavigering">
          <NuxtLink
            v-for="item in mainNavItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors"
            :class="
              isActive(item.to)
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            "
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            <UIcon v-if="item.icon" :name="item.icon" class="w-4 h-4" aria-hidden="true" />
            {{ item.label }}
          </NuxtLink>
        </nav>

        <!-- Right Side: User Menu + Color Mode + Mobile Menu -->
        <div class="flex items-center gap-2">
          <!-- User Menu -->
          <UDropdownMenu v-if="user" :items="userMenuItems">
            <UButton variant="ghost" class="flex items-center gap-2">
              <UAvatar
                :src="user.user_metadata?.avatar_url"
                :alt="user.email || 'User'"
                size="xs"
              />
              <span class="hidden lg:inline text-sm truncate max-w-32">
                {{ user.email }}
              </span>
              <UIcon name="i-heroicons-chevron-down" class="w-4 h-4" />
            </UButton>
          </UDropdownMenu>

          <UColorModeButton />

          <!-- Mobile Menu Button -->
          <button
            class="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            :aria-label="mobileMenuOpen ? 'Stäng meny' : 'Öppna meny'"
            :aria-expanded="mobileMenuOpen"
            aria-controls="mobile-navigation"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <UIcon
              :name="mobileMenuOpen ? 'i-heroicons-x-mark' : 'i-heroicons-bars-3'"
              class="w-6 h-6"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <!-- Mobile Navigation -->
      <nav
        v-if="mobileMenuOpen"
        id="mobile-navigation"
        class="md:hidden pb-4 space-y-1"
        aria-label="Mobilnavigering"
      >
        <NuxtLink
          v-for="item in mainNavItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors"
          :class="
            isActive(item.to)
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
          "
          :aria-current="isActive(item.to) ? 'page' : undefined"
          @click="mobileMenuOpen = false"
        >
          <UIcon v-if="item.icon" :name="item.icon" class="w-5 h-5" aria-hidden="true" />
          {{ item.label }}
        </NuxtLink>
      </nav>
    </UContainer>
  </header>
</template>

<script setup lang="ts">
const route = useRoute()
const { mainNavItems } = useNavigation()
const user = useSupabaseUser()
const supabase = useSupabaseClient()

const mobileMenuOpen = ref(false)

const userMenuItems = computed(() => [
  [
    {
      label: user.value?.email || 'User',
      disabled: true,
    },
  ],
  [
    {
      label: 'Sign out',
      icon: 'i-heroicons-arrow-right-on-rectangle',
      onSelect: handleLogout,
    },
  ],
])

async function handleLogout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}

function isActive(to: string): boolean {
  if (to === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(to)
}
</script>
