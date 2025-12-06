<template>
  <UBreadcrumb
    v-if="breadcrumbItems.length > 0"
    :items="formattedItems"
    class="mb-6"
  />
</template>

<script setup lang="ts">
const { breadcrumbItems } = useNavigation()

const formattedItems = computed(() =>
  breadcrumbItems.value.map(item => ({
    label: item.label,
    to: item.to,
    icon: item.icon,
  })),
)
</script>
