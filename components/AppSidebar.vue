<template>
  <aside
    class="v2-sidebar flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-full"
    :class="{ collapsed: collapsed && !isMobile }"
  >
    <!-- Logo -->
    <div class="flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-800">
      <NuxtLink to="/" class="flex items-center gap-3" aria-label="Stryktipset AI - Home">
        <UIcon name="i-heroicons-chart-bar-square" class="w-8 h-8 text-primary-500 flex-shrink-0" />
        <span
          v-if="!collapsed || isMobile"
          class="font-bold text-lg text-gray-900 dark:text-white truncate"
        >
          Stryktipset AI
        </span>
      </NuxtLink>
      <button
        v-if="isMobile"
        class="ml-auto p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="Close menu"
        @click="$emit('close')"
      >
        <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto py-4 px-2" aria-label="Main navigation">
      <ul class="space-y-1">
        <li v-for="item in mainNavItems" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
            :class="[
              isActive(item.to)
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
            ]"
            :aria-current="isActive(item.to) ? 'page' : undefined"
            @click="isMobile && $emit('close')"
          >
            <UIcon
              :name="item.icon || 'i-heroicons-square-3-stack-3d'"
              class="w-5 h-5 flex-shrink-0"
            />
            <span v-if="!collapsed || isMobile" class="truncate">{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>

      <!-- Recent Draws Section -->
      <div v-if="(!collapsed || isMobile) && recentDraws.length > 0" class="mt-6">
        <h3
          class="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2"
        >
          Recent Draws
        </h3>
        <ul class="space-y-1">
          <li v-for="draw in recentDraws" :key="draw.id">
            <NuxtLink
              :to="`/draw/${draw.draw_number}`"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              :class="[
                isDrawActive(draw.draw_number)
                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
              ]"
              @click="isMobile && $emit('close')"
            >
              <span
                class="w-12 h-5 flex items-center justify-center text-xs font-medium bg-gray-200 dark:bg-gray-700 rounded"
              >
                #{{ draw.draw_number }}
              </span>
              <span class="truncate">{{ draw.gameType }}</span>
              <UBadge
                v-if="draw.status === 'Open'"
                color="success"
                variant="subtle"
                size="xs"
                class="ml-auto"
              >
                Open
              </UBadge>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>

    <!-- User Section -->
    <div class="border-t border-gray-200 dark:border-gray-800 p-4">
      <div v-if="user" class="flex items-center gap-3">
        <UAvatar :src="user.user_metadata?.avatar_url" :alt="user.email || 'User'" size="sm" />
        <div v-if="!collapsed || isMobile" class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
            {{ user.email }}
          </p>
          <button
            class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            @click="handleLogout"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
defineProps<{
  collapsed?: boolean
  isMobile?: boolean
}>()

defineEmits<{
  close: []
}>()

const route = useRoute()
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const { mainNavItems } = useNavigation()

// Mock recent draws - in real implementation, fetch from API
const recentDraws = ref<{ id: number; draw_number: number; gameType: string; status: string }[]>([])

// Fetch recent draws on mount
onMounted(async () => {
  try {
    const response = await $fetch<{
      success: boolean
      draws?: { id: number; draw_number: number; game_type: string; status: string }[]
    }>('/api/draws/current')
    if (response.success && response.draws) {
      recentDraws.value = response.draws.slice(0, 3).map(d => ({
        id: d.id,
        draw_number: d.draw_number,
        gameType: d.game_type,
        status: d.status,
      }))
    }
  } catch {
    // Silently fail - recent draws is a nice-to-have
  }
})

function isActive(to: string): boolean {
  if (to === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(to)
}

function isDrawActive(drawNumber: number): boolean {
  return route.path === `/draw/${drawNumber}` || route.path.startsWith(`/draw/${drawNumber}/`)
}

async function handleLogout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<style scoped>
.v2-sidebar {
  position: relative;
  width: var(--sidebar-width);
  transition: width 0.2s ease;
}

.v2-sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}
</style>
