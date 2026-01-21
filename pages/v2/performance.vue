<template>
  <UContainer class="py-8">
    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2">System Performance</h1>
      <p class="text-gray-600 dark:text-gray-400">
        Track and analyze the performance of your betting systems over time
      </p>
    </div>

    <OptimizePerformanceDashboard />
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'v2',
})

useHead({
  title: 'System Performance - Stryktipset AI Predictor',
})
</script>
