import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { RealtimeScrapingStatus, ScrapingOperationEvent, ScrapedDataEvent } from '~/types'
import { getCurrentInstance } from 'vue'

export function useScrapingUpdates(matchId: Ref<number> | number) {
  const { $supabase } = useNuxtApp() as { $supabase: SupabaseClient | null }
  const matchIdRef = isRef(matchId) ? matchId : ref(matchId)

  // Reactive state
  const scrapingStatus = ref<Record<string, RealtimeScrapingStatus>>({})
  const scrapedDataTypes = ref<string[]>([])
  const isAnyScraping = computed(() => {
    return Object.values(scrapingStatus.value).some(
      status => status.status === 'started' || status.status === 'in_progress'
    )
  })
  const latestOperation = ref<ScrapingOperationEvent | null>(null)

  let operationsChannel: RealtimeChannel | null = null
  let dataChannel: RealtimeChannel | null = null

  // Initialize status for common data types
  const initializeStatus = () => {
    const dataTypes = ['xStats', 'statistics', 'headToHead', 'news']
    const newStatus: Record<string, RealtimeScrapingStatus> = {}

    dataTypes.forEach(dataType => {
      newStatus[dataType] = {
        dataType,
        status: 'idle',
      }
    })

    scrapingStatus.value = newStatus
  }

  // Subscribe to scrape_operations table for progress updates
  const subscribeToOperations = () => {
    if (!$supabase) {
      console.warn('[useScrapingUpdates] Supabase client not available')
      return
    }

    operationsChannel = $supabase
      .channel(`scrape_operations:${matchIdRef.value}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scrape_operations',
          filter: `match_id=eq.${matchIdRef.value}`,
        },
        (payload: { new: ScrapingOperationEvent }) => {
          const operation = payload.new
          latestOperation.value = operation

          if (!operation.operation_type) return

          const currentStatus = scrapingStatus.value[operation.operation_type] || {
            dataType: operation.operation_type,
            status: 'idle',
          }

          // Map database status to our status
          let status: RealtimeScrapingStatus['status'] = 'idle'
          if (operation.status === 'started' || operation.status === 'in_progress') {
            status = 'in_progress'
          } else if (operation.status === 'success') {
            status = 'success'
          } else if (operation.status === 'failed') {
            status = 'failed'
          } else if (operation.status === 'rate_limited') {
            status = 'rate_limited'
          }

          scrapingStatus.value[operation.operation_type] = {
            ...currentStatus,
            status,
            message: getStatusMessage(operation.operation_type, status),
            error: operation.error_message || undefined,
            startedAt: new Date(operation.started_at),
            completedAt: operation.completed_at ? new Date(operation.completed_at) : undefined,
            durationMs: operation.duration_ms || undefined,
            retryCount: operation.retry_count,
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scrape_operations',
          filter: `match_id=eq.${matchIdRef.value}`,
        },
        (payload: { new: ScrapingOperationEvent }) => {
          const operation = payload.new
          latestOperation.value = operation

          if (!operation.operation_type) return

          const currentStatus = scrapingStatus.value[operation.operation_type] || {
            dataType: operation.operation_type,
            status: 'idle',
          }

          let status: RealtimeScrapingStatus['status'] = 'idle'
          if (operation.status === 'started' || operation.status === 'in_progress') {
            status = 'in_progress'
          } else if (operation.status === 'success') {
            status = 'success'
          } else if (operation.status === 'failed') {
            status = 'failed'
          } else if (operation.status === 'rate_limited') {
            status = 'rate_limited'
          }

          scrapingStatus.value[operation.operation_type] = {
            ...currentStatus,
            status,
            message: getStatusMessage(operation.operation_type, status),
            error: operation.error_message || undefined,
            completedAt: operation.completed_at ? new Date(operation.completed_at) : undefined,
            durationMs: operation.duration_ms || undefined,
            retryCount: operation.retry_count,
          }
        }
      )
      .subscribe()
  }

  // Subscribe to match_scraped_data table for completion notifications
  const subscribeToScrapedData = () => {
    if (!$supabase) {
      console.warn('[useScrapingUpdates] Supabase client not available')
      return
    }

    dataChannel = $supabase
      .channel(`match_scraped_data:${matchIdRef.value}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_scraped_data',
          filter: `match_id=eq.${matchIdRef.value}`,
        },
        (payload: { new: ScrapedDataEvent }) => {
          const data = payload.new

          if (!scrapedDataTypes.value.includes(data.data_type)) {
            scrapedDataTypes.value.push(data.data_type)
          }

          // Update status to success
          const currentStatus = scrapingStatus.value[data.data_type] || {
            dataType: data.data_type,
            status: 'idle',
          }

          scrapingStatus.value[data.data_type] = {
            ...currentStatus,
            status: 'success',
            message: getStatusMessage(data.data_type, 'success'),
            completedAt: new Date(data.scraped_at),
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'match_scraped_data',
          filter: `match_id=eq.${matchIdRef.value}`,
        },
        (payload: { new: ScrapedDataEvent }) => {
          const data = payload.new

          if (!scrapedDataTypes.value.includes(data.data_type)) {
            scrapedDataTypes.value.push(data.data_type)
          }

          // Update status to success
          const currentStatus = scrapingStatus.value[data.data_type] || {
            dataType: data.data_type,
            status: 'idle',
          }

          scrapingStatus.value[data.data_type] = {
            ...currentStatus,
            status: 'success',
            message: getStatusMessage(data.data_type, 'success'),
            completedAt: new Date(data.scraped_at),
          }
        }
      )
      .subscribe()
  }

  // Helper to get user-friendly status messages
  const getStatusMessage = (dataType: string, status: RealtimeScrapingStatus['status']): string => {
    const dataTypeLabels: Record<string, string> = {
      xStats: 'xStats',
      statistics: 'Statistics',
      headToHead: 'Head-to-Head',
      news: 'News',
    }

    const label = dataTypeLabels[dataType] || dataType

    switch (status) {
      case 'started':
      case 'in_progress':
        return `Scraping ${label}...`
      case 'success':
        return `${label} completed`
      case 'failed':
        return `${label} failed`
      case 'rate_limited':
        return `${label} rate limited`
      default:
        return ''
    }
  }

  // Reset status for all data types
  const resetStatus = () => {
    initializeStatus()
    scrapedDataTypes.value = []
    latestOperation.value = null
  }

  // Cleanup subscriptions
  const cleanup = async () => {
    if (operationsChannel && $supabase) {
      await $supabase.removeChannel(operationsChannel)
      operationsChannel = null
    }
    if (dataChannel && $supabase) {
      await $supabase.removeChannel(dataChannel)
      dataChannel = null
    }
  }

  // Auto-initialize function (can be called during setup or manually)
  const initialize = () => {
    initializeStatus()
    subscribeToOperations()
    subscribeToScrapedData()
  }

  // Try to use lifecycle hooks if in component setup context
  // This will work for components, but won't throw errors if called elsewhere
  if (getCurrentInstance()) {
    onMounted(() => {
      initialize()
    })

    onUnmounted(() => {
      cleanup()
    })
  } else {
    // If not in component context, initialize immediately and warn
    console.warn(
      '[useScrapingUpdates] Called outside component setup, initializing immediately. Remember to call cleanup() manually.'
    )
    initialize()
  }

  return {
    scrapingStatus: readonly(scrapingStatus),
    scrapedDataTypes: readonly(scrapedDataTypes),
    isAnyScraping,
    latestOperation: readonly(latestOperation),
    resetStatus,
    cleanup,
    initialize, // Export initialize for manual control if needed
  }
}
