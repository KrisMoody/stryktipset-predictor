<template>
  <div class="match-card-v2 animate-pulse">
    <div class="match-card-v2__header">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div class="space-y-2">
          <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div class="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>
    <div class="match-card-v2__body">
      <div class="grid grid-cols-2 gap-6">
        <div class="space-y-3">
          <div class="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div class="grid grid-cols-3 gap-2">
            <div class="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div class="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div class="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        <div class="space-y-3">
          <div class="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>
    <div class="match-card-v2__footer">
      <div class="flex gap-2">
        <div class="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        <div class="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        <div class="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  </div>
</template>
