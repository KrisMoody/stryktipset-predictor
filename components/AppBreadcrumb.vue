<template>
  <nav v-if="breadcrumbItems.length > 0" aria-label="Breadcrumb" class="mb-4">
    <ol class="flex items-center gap-2 text-sm">
      <li v-for="(item, index) in breadcrumbItems" :key="index" class="flex items-center gap-2">
        <UIcon
          v-if="index > 0"
          name="i-heroicons-chevron-right"
          class="w-4 h-4 text-gray-400"
          aria-hidden="true"
        />
        <NuxtLink
          v-if="item.to"
          :to="item.to"
          class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <UIcon v-if="item.icon" :name="item.icon" class="w-4 h-4" aria-hidden="true" />
          {{ item.label }}
        </NuxtLink>
        <span v-else class="flex items-center gap-1.5 text-gray-900 dark:text-white font-medium">
          <UIcon v-if="item.icon" :name="item.icon" class="w-4 h-4" aria-hidden="true" />
          {{ item.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
const { breadcrumbItems } = useNavigation()
</script>
