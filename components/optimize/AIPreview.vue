<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <UCard
      v-for="selection in selections"
      :key="selection.matchNumber"
      class="hover:shadow-md transition-shadow"
    >
      <div class="space-y-3">
        <div class="flex items-start justify-between">
          <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {{ selection.matchNumber }}. {{ selection.homeTeam }} - {{ selection.awayTeam }}
          </div>
          <UBadge
            v-if="selection.is_spik"
            color="warning"
            variant="soft"
            size="sm"
          >
            🎯 Spik
          </UBadge>
        </div>

        <div class="text-center">
          <div class="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-1">
            {{ selection.selection }}
          </div>
          <div class="text-xs text-gray-600 dark:text-gray-400">
            EV: <span :class="getEVColor(selection.expected_value)">
              {{ selection.expected_value.toFixed(1) }}%
            </span>
          </div>
        </div>

        <div class="text-xs text-gray-500 dark:text-gray-500 border-t pt-2">
          {{ selection.reasoning }}
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { CouponSelection } from '~/types'

defineProps<{
  selections: CouponSelection[]
}>()

const getEVColor = (ev: number) => {
  if (ev > 10) return 'text-green-600 dark:text-green-400 font-semibold'
  if (ev > 0) return 'text-blue-600 dark:text-blue-400'
  return 'text-gray-600 dark:text-gray-400'
}
</script>
