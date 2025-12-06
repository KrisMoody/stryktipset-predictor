<template>
  <div class="space-y-6">
    <!-- Filter Controls -->
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">
          Filter Systems
        </h3>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-if="filters.type === 'R'">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Guarantee
          </label>
          <USelect
            v-model="filters.guaranteeStr"
            :items="guaranteeOptions"
          />
        </div>

        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Max Cost (SEK)
          </label>
          <UInput
            v-model.number="filters.maxCost"
            type="number"
            placeholder="No limit"
          />
        </div>

        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Sort By
          </label>
          <USelect
            v-model="filters.sortByStr"
            :items="sortOptions"
          />
        </div>
      </div>

      <div
        v-if="systemType !== 'all'"
        class="mt-4"
      >
        <UBadge
          color="primary"
          variant="soft"
          size="lg"
        >
          Showing {{ systemType }}-systems only
        </UBadge>
      </div>
    </UCard>

    <!-- System Grid -->
    <div
      v-if="filteredSystems.length > 0"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <UCard
        v-for="system in filteredSystems"
        :key="system.id"
        :class="[
          'cursor-pointer transition-all hover:shadow-lg',
          selectedSystemId === system.id
            ? 'border-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border border-gray-200 dark:border-gray-700',
        ]"
        @click="selectSystem(system)"
      >
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100">
              {{ system.id }}
            </h4>
            <UBadge
              :color="system.type === 'R' ? 'info' : 'secondary'"
              variant="soft"
            >
              {{ system.type }}-system
            </UBadge>
          </div>

          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div class="text-gray-500 dark:text-gray-400">
                Helgarderingar
              </div>
              <div class="font-semibold">
                {{ system.helgarderingar }}
              </div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400">
                Halvgarderingar
              </div>
              <div class="font-semibold">
                {{ system.halvgarderingar }}
              </div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400">
                Rows
              </div>
              <div class="font-semibold text-primary-600 dark:text-primary-400">
                {{ system.rows }}
              </div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400">
                Cost
              </div>
              <div class="font-semibold">
                {{ system.rows }} SEK
              </div>
            </div>
          </div>

          <div
            v-if="system.guarantee"
            class="pt-2 border-t border-gray-200 dark:border-gray-700"
          >
            <UBadge
              :color="getGuaranteeColor(system.guarantee)"
              variant="subtle"
            >
              Guarantee: {{ system.guarantee }} rätt
            </UBadge>
          </div>

          <div class="text-xs text-gray-500 dark:text-gray-400 pt-2">
            {{ getReductionRatio(system) }} reduction
          </div>
        </div>
      </UCard>
    </div>

    <div
      v-else
      class="text-center py-12"
    >
      <div class="text-gray-500 dark:text-gray-400">
        No systems match your filters
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BettingSystem } from '~/types'

const props = defineProps<{
  systemType: 'R' | 'U' | 'all'
  selectedSystemId?: string
}>()

const emit = defineEmits<{
  select: [system: BettingSystem]
}>()

// Fetch all systems
const { data: systemsData } = await useFetch('/api/betting-systems')

const allSystems = computed(() => {
  if (!systemsData.value?.success) return []
  return [
    ...(systemsData.value.systems.R || []),
    ...(systemsData.value.systems.U || []),
  ]
})

// Filters
const filters = ref({
  type: props.systemType === 'all' ? null : props.systemType,
  guaranteeStr: 'All Guarantees' as string,
  maxCost: null as number | null,
  sortByStr: 'Cost (Low to High)' as string,
})

// Map string selections to actual values
const guarantee = computed(() => {
  switch (filters.value.guaranteeStr) {
    case '10 rätt': return 10
    case '11 rätt': return 11
    case '12 rätt': return 12
    default: return null
  }
})

const sortBy = computed(() => {
  switch (filters.value.sortByStr) {
    case 'Cost (High to Low)': return 'cost-desc'
    case 'Coverage (High to Low)': return 'coverage-desc'
    case 'Guarantee (High to Low)': return 'guarantee-desc'
    default: return 'cost-asc'
  }
})

// Watch for systemType prop changes
watch(() => props.systemType, (newType) => {
  filters.value.type = newType === 'all' ? null : newType
})

const _typeOptions = [
  { label: 'All Types', value: null },
  { label: 'R-systems', value: 'R' },
  { label: 'U-systems', value: 'U' },
]

const guaranteeOptions = [
  'All Guarantees',
  '10 rätt',
  '11 rätt',
  '12 rätt',
]

const sortOptions = [
  'Cost (Low to High)',
  'Cost (High to Low)',
  'Coverage (High to Low)',
  'Guarantee (High to Low)',
]

// Filtered and sorted systems
const filteredSystems = computed(() => {
  let systems = [...allSystems.value]

  // Filter by type
  if (filters.value.type) {
    systems = systems.filter(s => s.type === filters.value.type)
  }

  // Filter by guarantee
  if (guarantee.value !== null) {
    systems = systems.filter(s => s.guarantee === guarantee.value)
  }

  // Filter by max cost
  if (filters.value.maxCost) {
    systems = systems.filter(s => s.rows <= filters.value.maxCost!)
  }

  // Sort
  switch (sortBy.value) {
    case 'cost-asc':
      systems.sort((a, b) => a.rows - b.rows)
      break
    case 'cost-desc':
      systems.sort((a, b) => b.rows - a.rows)
      break
    case 'coverage-desc':
      systems.sort((a, b) => {
        const coverageA = a.helgarderingar + a.halvgarderingar
        const coverageB = b.helgarderingar + b.halvgarderingar
        return coverageB - coverageA
      })
      break
    case 'guarantee-desc':
      systems.sort((a, b) => (b.guarantee || 0) - (a.guarantee || 0))
      break
  }

  return systems
})

// Methods
const selectSystem = (system: BettingSystem) => {
  emit('select', system)
}

const getGuaranteeColor = (guarantee: number) => {
  if (guarantee >= 12) return 'success'
  if (guarantee >= 11) return 'primary'
  return 'warning'
}

const getReductionRatio = (system: BettingSystem) => {
  const fullRows = Math.pow(3, system.helgarderingar) * Math.pow(2, system.halvgarderingar)
  const ratio = (system.rows / fullRows * 100).toFixed(1)
  return `${ratio}%`
}
</script>
