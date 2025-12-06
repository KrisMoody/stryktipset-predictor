<template>
  <div class="space-y-6">
    <!-- Summary Card -->
    <UCard>
      <template #header>
        <h3 class="text-xl font-semibold">
          Coupon Summary
        </h3>
      </template>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            System
          </div>
          <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {{ 'system' in coupon && coupon.system?.id ? coupon.system.id : 'AI-Based' }}
          </div>
        </div>
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            Total Rows
          </div>
          <div class="text-2xl font-bold">
            {{ couponRows.length || ('totalCombinations' in coupon ? coupon.totalCombinations : 0) }}
          </div>
        </div>
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            Total Cost
          </div>
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">
            {{ coupon.totalCost }} SEK
          </div>
        </div>
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            Expected Value
          </div>
          <div
            class="text-2xl font-bold"
            :class="coupon.expectedValue > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'"
          >
            {{ coupon.expectedValue.toFixed(1) }}%
          </div>
        </div>
      </div>

      <div
        v-if="'system' in coupon && coupon.system?.guarantee"
        class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
      >
        <UBadge
          color="success"
          variant="soft"
          size="lg"
        >
          Guarantee: {{ coupon.system.guarantee }} rätt when frame is correct
        </UBadge>
      </div>
    </UCard>

    <!-- Match-Based View (Primary) -->
    <UCard v-if="couponRows.length > 0">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h3 class="text-xl font-semibold">
              Match Coverage
            </h3>
            <UBadge
              v-if="couponId && couponStatus"
              :color="getStatusColor(couponStatus)"
              variant="soft"
            >
              {{ formatStatus(couponStatus) }}
            </UBadge>
          </div>
          <div class="flex gap-2">
            <UButton
              variant="outline"
              size="sm"
              icon="i-heroicons-clipboard-document"
              @click="copyToClipboard"
            >
              Copy
            </UButton>
            <UButton
              variant="outline"
              size="sm"
              icon="i-heroicons-arrow-down-tray"
              @click="downloadCSV"
            >
              Download CSV
            </UButton>
            <UDropdown
              :items="svenskaSpelExportItems"
              :popper="{ placement: 'bottom-end' }"
            >
              <UButton
                color="primary"
                size="sm"
                icon="i-heroicons-document-arrow-down"
                trailing-icon="i-heroicons-chevron-down"
              >
                Svenska Spel
              </UButton>
            </UDropdown>
          </div>
        </div>
      </template>

      <div class="space-y-3">
        <div
          v-for="matchNum in 13"
          :key="matchNum"
          class="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
        >
          <div class="w-24 flex-shrink-0">
            <div class="font-semibold text-gray-900 dark:text-gray-100">
              Match {{ matchNum }}
            </div>
            <div
              v-if="getMatchInfo(matchNum)"
              class="text-xs text-gray-600 dark:text-gray-400"
            >
              {{ getMatchInfo(matchNum)?.homeTeam }} - {{ getMatchInfo(matchNum)?.awayTeam }}
            </div>
          </div>

          <div class="flex items-center gap-2 flex-1">
            <UBadge
              v-for="outcome in getMatchOutcomes(matchNum)"
              :key="outcome"
              :color="getOutcomeBadgeColor(matchNum, outcome)"
              :variant="getOutcomeBadgeVariant(matchNum, outcome)"
              size="lg"
              class="px-4 py-2 text-base font-bold"
            >
              {{ outcome }}
            </UBadge>
          </div>

          <div class="text-sm text-gray-600 dark:text-gray-400">
            {{ getMatchCoverageText(matchNum) }}
          </div>
        </div>
      </div>
    </UCard>

    <!-- Advanced View: Row-by-Row Table (Collapsible) -->
    <UCard v-if="couponRows.length > 0">
      <template #header>
        <button
          class="flex items-center justify-between w-full text-left"
          :aria-expanded="showAdvancedView"
          aria-controls="advanced-view-panel"
          @click="showAdvancedView = !showAdvancedView"
        >
          <h3 class="text-xl font-semibold">
            Advanced View: All Rows
          </h3>
          <UIcon
            :name="showAdvancedView ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
            class="w-5 h-5"
            aria-hidden="true"
          />
        </button>
      </template>

      <div
        v-if="showAdvancedView"
        id="advanced-view-panel"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <caption class="sr-only">
              Alla kupongrader med utfall per match
            </caption>
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  scope="col"
                  class="px-3 py-2 text-left font-semibold"
                >
                  Row
                </th>
                <th
                  v-for="i in 13"
                  :key="i"
                  scope="col"
                  class="px-2 py-2 text-center font-semibold"
                >
                  <span class="sr-only">Match </span>{{ i }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in displayedRows"
                :key="row.rowNumber"
                :class="idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'"
              >
                <th
                  scope="row"
                  class="px-3 py-2 font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ row.rowNumber }}
                </th>
                <td
                  v-for="(pick, pickIdx) in row.picks"
                  :key="pickIdx"
                  class="px-2 py-2 text-center"
                  :class="getPickClass(pick, pickIdx + 1)"
                >
                  {{ pick }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination for large coupons -->
        <div
          v-if="couponRows.length > rowsPerPage"
          class="mt-4 flex items-center justify-between"
        >
          <div class="text-sm text-gray-600 dark:text-gray-400">
            Showing {{ (currentPage - 1) * rowsPerPage + 1 }} - {{ Math.min(currentPage * rowsPerPage, couponRows.length) }} of {{ couponRows.length }} rows
          </div>
          <div class="flex gap-2">
            <UButton
              :disabled="currentPage === 1"
              variant="outline"
              size="sm"
              icon="i-heroicons-chevron-left"
              @click="currentPage--"
            >
              Previous
            </UButton>
            <UButton
              :disabled="currentPage * rowsPerPage >= couponRows.length"
              variant="outline"
              size="sm"
              icon="i-heroicons-chevron-right"
              @click="currentPage++"
            >
              Next
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Selections Summary (for AI-based coupons) -->
    <UCard v-if="couponRows.length === 0 && coupon.selections">
      <template #header>
        <h3 class="text-xl font-semibold">
          Match Selections
        </h3>
      </template>

      <div class="space-y-2">
        <div
          v-for="selection in coupon.selections"
          :key="selection.matchNumber"
          class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
        >
          <div>
            <div class="font-semibold">
              {{ selection.matchNumber }}. {{ selection.homeTeam }} - {{ selection.awayTeam }}
            </div>
            <div class="text-xs text-gray-600 dark:text-gray-400">
              {{ selection.reasoning }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {{ selection.selection }}
            </div>
            <UBadge
              v-if="selection.is_spik"
              color="warning"
              variant="soft"
            >
              Spik
            </UBadge>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Mark as Played Modal -->
    <OptimizeMarkPlayedModal
      v-if="couponId"
      v-model="showMarkPlayedModal"
      :coupon-id="couponId"
      :action-type="pendingAction"
      @completed="handleMarkPlayedCompleted"
    />
  </div>
</template>

<script setup lang="ts">
import type { SystemCoupon, OptimalCoupon, CouponRow, CouponStatus } from '~/types'
import {
  validateForEnkelraderExport,
  validateForMSystemExport,
  generateEnkelraderContent,
  generateMSystemContent,
  generateExportFilename,
  downloadAsTextFile,
  calculateMSystemRowCount,
} from '~/utils/svenska-spel-export'

const props = defineProps<{
  coupon: SystemCoupon | OptimalCoupon
  couponId?: number
  couponStatus?: CouponStatus
}>()

const emit = defineEmits<{
  statusUpdated: [status: CouponStatus]
}>()

// Type guard to check if coupon is a SystemCoupon (has rows)
function isSystemCoupon(c: SystemCoupon | OptimalCoupon): c is SystemCoupon {
  return 'rows' in c && Array.isArray(c.rows)
}

// Helper to safely get rows
const couponRows = computed<CouponRow[]>(() => {
  return isSystemCoupon(props.coupon) ? props.coupon.rows : []
})

// View state
const showAdvancedView = ref(false)

// Pagination
const rowsPerPage = 50
const currentPage = ref(1)

const displayedRows = computed(() => {
  if (couponRows.value.length === 0) return []
  const start = (currentPage.value - 1) * rowsPerPage
  const end = start + rowsPerPage
  return couponRows.value.slice(start, end)
})

// Modal state for "Mark as Played"
const showMarkPlayedModal = ref(false)
const pendingAction = ref<'copy' | 'download'>('copy')

// Match-based view functions
const getMatchOutcomes = (matchNum: number): string[] => {
  if (couponRows.value.length === 0) return []

  const outcomes = new Set<string>()
  couponRows.value.forEach((row) => {
    const pick = row.picks[matchNum - 1]
    if (pick) outcomes.add(pick)
  })

  return Array.from(outcomes).sort()
}

const getMatchInfo = (matchNum: number) => {
  return props.coupon.selections?.find(s => s.matchNumber === matchNum)
}

const getOutcomeBadgeColor = (matchNum: number, outcome: string): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' => {
  const matchInfo = getMatchInfo(matchNum)
  if (matchInfo?.is_spik) {
    return 'warning'
  }

  // Check if this is the AI's predicted outcome
  if (matchInfo?.selection === outcome || matchInfo?.selection.includes(outcome)) {
    return 'primary'
  }

  return 'neutral'
}

const getOutcomeBadgeVariant = (matchNum: number, outcome: string) => {
  const matchInfo = getMatchInfo(matchNum)

  // Spik is solid
  if (matchInfo?.is_spik) {
    return 'solid'
  }

  // AI prediction is soft
  if (matchInfo?.selection === outcome || matchInfo?.selection.includes(outcome)) {
    return 'soft'
  }

  return 'outline'
}

const getMatchCoverageText = (matchNum: number): string => {
  const outcomes = getMatchOutcomes(matchNum)
  const matchInfo = getMatchInfo(matchNum)

  if (matchInfo?.is_spik) {
    return 'Spik'
  }

  if (outcomes.length === 3) {
    return 'Helgarderad'
  }

  if (outcomes.length === 2) {
    return 'Halvgarderad'
  }

  return 'Fast tecken'
}

// Styling
const getPickClass = (pick: string, matchNumber: number) => {
  const selection = props.coupon.selections?.find(s => s.matchNumber === matchNumber)
  const isSpik = selection?.is_spik

  return [
    'font-semibold',
    isSpik ? 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30' : 'text-gray-900 dark:text-gray-100',
  ]
}

// Export functions
const copyToClipboard = async () => {
  const text = generateCouponText()
  try {
    await navigator.clipboard.writeText(text)
    console.log('Copied to clipboard!')

    // Show modal if coupon is persisted and not already played
    if (props.couponId && props.couponStatus !== 'played') {
      pendingAction.value = 'copy'
      showMarkPlayedModal.value = true
    }
  }
  catch (err) {
    console.error('Failed to copy:', err)
  }
}

const downloadCSV = () => {
  const csv = generateCSV()
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const systemId = 'system' in props.coupon && props.coupon.system?.id ? props.coupon.system.id : 'ai'
  a.download = `coupon-${props.coupon.drawNumber}-${systemId}.csv`
  a.click()
  window.URL.revokeObjectURL(url)

  // Show modal if coupon is persisted and not already played
  if (props.couponId && props.couponStatus !== 'played') {
    pendingAction.value = 'download'
    showMarkPlayedModal.value = true
  }
}

// Handle modal completion
const handleMarkPlayedCompleted = (markedPlayed: boolean) => {
  if (markedPlayed) {
    emit('statusUpdated', 'played')
  }
}

// Status display helpers
const getStatusColor = (status: CouponStatus): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' => {
  switch (status) {
    case 'generated': return 'neutral'
    case 'saved': return 'info'
    case 'played': return 'success'
    case 'analyzed': return 'primary'
    default: return 'neutral'
  }
}

const formatStatus = (status: CouponStatus): string => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const generateCouponText = (): string => {
  if (couponRows.value.length === 0) return ''

  const systemId = 'system' in props.coupon && props.coupon.system?.id ? props.coupon.system.id : 'AI-Based'
  let text = `Coupon for Draw #${props.coupon.drawNumber}\n`
  text += `System: ${systemId}\n`
  text += `Total Rows: ${couponRows.value.length}\n`
  text += `Total Cost: ${props.coupon.totalCost} SEK\n\n`

  text += 'Row | ' + Array.from({ length: 13 }, (_, i) => i + 1).join(' | ') + '\n'
  text += '-'.repeat(60) + '\n'

  couponRows.value.forEach((row) => {
    text += `${row.rowNumber.toString().padStart(3)} | ${row.picks.join(' | ')}\n`
  })

  return text
}

const generateCSV = (): string => {
  if (couponRows.value.length === 0) return ''

  let csv = 'Row,' + Array.from({ length: 13 }, (_, i) => i + 1).join(',') + '\n'

  couponRows.value.forEach((row) => {
    csv += `${row.rowNumber},${row.picks.join(',')}\n`
  })

  return csv
}

// ============================================================================
// Svenska Spel Export
// ============================================================================

const toast = useToast()

// Get system ID helper
const getSystemId = () => {
  return 'system' in props.coupon && props.coupon.system?.id
    ? props.coupon.system.id
    : undefined
}

// Check if Enkelrader export is available
const canExportEnkelrader = computed(() => {
  if (couponRows.value.length === 0) return false
  const validation = validateForEnkelraderExport(couponRows.value)
  return validation.isValid
})

// Check if M-system export is available
const canExportMSystem = computed(() => {
  if (!props.coupon.selections || props.coupon.selections.length !== 13) return false
  const validation = validateForMSystemExport(props.coupon.selections)
  return validation.isValid
})

// Get M-system row count for display
const mSystemRowCount = computed(() => {
  if (!props.coupon.selections) return 0
  return calculateMSystemRowCount(props.coupon.selections)
})

// Dropdown menu items for Svenska Spel export
const svenskaSpelExportItems = computed(() => [
  [{
    label: `Enkelrader (${couponRows.value.length} rows)`,
    icon: 'i-heroicons-list-bullet',
    click: downloadEnkelrader,
    disabled: !canExportEnkelrader.value,
  }],
  [{
    label: `M-system (${mSystemRowCount.value} rows)`,
    icon: 'i-heroicons-square-3-stack-3d',
    click: downloadMSystem,
    disabled: !canExportMSystem.value,
  }],
])

// Download as Enkelrader format
const downloadEnkelrader = () => {
  const validation = validateForEnkelraderExport(couponRows.value)

  if (!validation.isValid) {
    toast.add({
      title: 'Export Failed',
      description: validation.errors.join('; '),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
    return
  }

  if (validation.warnings.length > 0) {
    toast.add({
      title: 'Export Warning',
      description: validation.warnings.join('; '),
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle',
    })
  }

  const content = generateEnkelraderContent(couponRows.value)
  const filename = generateExportFilename(props.coupon.drawNumber, getSystemId(), 'enkelrader')
  downloadAsTextFile(content, filename)

  toast.add({
    title: 'Downloaded',
    description: `${couponRows.value.length} rows exported as Enkelrader`,
    color: 'success',
    icon: 'i-heroicons-check-circle',
  })

  // Show modal if coupon is persisted and not already played
  if (props.couponId && props.couponStatus !== 'played') {
    pendingAction.value = 'download'
    showMarkPlayedModal.value = true
  }
}

// Download as M-system format
const downloadMSystem = () => {
  if (!props.coupon.selections) {
    toast.add({
      title: 'Export Failed',
      description: 'No selections available for M-system export',
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
    return
  }

  const validation = validateForMSystemExport(props.coupon.selections)

  if (!validation.isValid) {
    toast.add({
      title: 'Export Failed',
      description: validation.errors.join('; '),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
    return
  }

  const content = generateMSystemContent(props.coupon.selections)
  const filename = generateExportFilename(props.coupon.drawNumber, getSystemId(), 'msystem')
  downloadAsTextFile(content, filename)

  toast.add({
    title: 'Downloaded',
    description: `M-system with ${mSystemRowCount.value} rows exported`,
    color: 'success',
    icon: 'i-heroicons-check-circle',
  })

  // Show modal if coupon is persisted and not already played
  if (props.couponId && props.couponStatus !== 'played') {
    pendingAction.value = 'download'
    showMarkPlayedModal.value = true
  }
}
</script>
