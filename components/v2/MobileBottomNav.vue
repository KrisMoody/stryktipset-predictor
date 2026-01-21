<template>
  <nav class="mobile-bottom-nav" aria-label="Mobile navigation">
    <NuxtLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="mobile-bottom-nav__item"
      :class="{ 'mobile-bottom-nav__item--active': isActive(item.to) }"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      <UIcon :name="item.icon" class="w-6 h-6" />
      <span class="text-xs">{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()

const navItems = [
  { label: 'Dashboard', to: '/', icon: 'i-heroicons-home' },
  { label: 'Draw', to: '/draw', icon: 'i-heroicons-queue-list' },
  { label: 'Analytics', to: '/analytics', icon: 'i-heroicons-chart-bar' },
  { label: 'Profile', to: '/admin', icon: 'i-heroicons-user-circle' },
]

function isActive(to: string): boolean {
  if (to === '/') {
    return route.path === '/'
  }
  if (to === '/draw') {
    return route.path.startsWith('/draw')
  }
  return route.path.startsWith(to)
}
</script>
