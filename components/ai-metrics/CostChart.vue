<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          {{ title }}
        </h3>
        <UFieldGroup v-if="!hidePeriodSelector" size="xs">
          <UButton
            v-for="period in periods"
            :key="period.value"
            :variant="selectedPeriod === period.value ? 'solid' : 'ghost'"
            @click="$emit('period-change', period.value)"
          >
            {{ period.label }}
          </UButton>
        </UFieldGroup>
      </div>
    </template>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>

    <div v-else-if="chartData && chartData.length > 0" class="h-64">
      <canvas ref="chartCanvas" />
    </div>

    <div v-else class="text-center py-12 text-gray-500">
      No data available for the selected period
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { Chart, registerables } from 'chart.js'
import type { CostTrendDataPoint } from '~/types'

Chart.register(...registerables)

interface Props {
  title: string
  chartData: CostTrendDataPoint[] | null
  loading?: boolean
  chartType?: 'line' | 'bar'
  dataKey?: 'cost' | 'tokens' | 'requests'
  selectedPeriod?: 'daily' | 'weekly' | 'monthly'
  hidePeriodSelector?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  chartType: 'line',
  dataKey: 'cost',
  selectedPeriod: 'daily',
  hidePeriodSelector: false,
})

defineEmits<{
  'period-change': [period: 'daily' | 'weekly' | 'monthly']
}>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const periods: Array<{ label: string; value: 'daily' | 'weekly' | 'monthly' }> = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
]

watch(
  () => props.chartData,
  () => {
    nextTick(() => {
      renderChart()
    })
  },
  { deep: true }
)

onMounted(() => {
  renderChart()
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})

function renderChart() {
  if (!chartCanvas.value || !props.chartData || props.chartData.length === 0) {
    return
  }

  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy()
  }

  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return

  const labels = props.chartData.map(d => d.date)
  const data = props.chartData.map(d => {
    switch (props.dataKey) {
      case 'tokens':
        return d.tokens
      case 'requests':
        return d.requests
      case 'cost':
      default:
        return d.cost
    }
  })

  chartInstance = new Chart(ctx, {
    type: props.chartType,
    data: {
      labels,
      datasets: [
        {
          label: getDataLabel(),
          data,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: context => {
              const value = context.parsed.y
              return `${getDataLabel()}: ${formatValue(value ?? 0)}`
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => formatValue(value as number),
          },
        },
      },
    },
  })
}

function getDataLabel(): string {
  switch (props.dataKey) {
    case 'tokens':
      return 'Tokens'
    case 'requests':
      return 'Requests'
    case 'cost':
    default:
      return 'Cost'
  }
}

function formatValue(value: number): string {
  switch (props.dataKey) {
    case 'cost':
      return `$${value.toFixed(2)}`
    case 'tokens':
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`
      }
      return value.toString()
    case 'requests':
      return value.toString()
    default:
      return value.toString()
  }
}
</script>
