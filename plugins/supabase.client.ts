import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const supabaseUrl = config.public.supabaseUrl
  const supabaseAnonKey = config.public.supabaseAnonKey

  let supabase: SupabaseClient | null = null

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase Plugin] Missing Supabase configuration. Realtime features will not work.')
  }
  else {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  }

  return {
    provide: {
      supabase,
    },
  }
})
