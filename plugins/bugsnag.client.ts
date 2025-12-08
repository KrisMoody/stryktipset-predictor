import Bugsnag from '@bugsnag/js'
import BugsnagPluginVue from '@bugsnag/plugin-vue'

export default defineNuxtPlugin(nuxtApp => {
  const config = useRuntimeConfig()

  // Only initialize if API key is configured
  if (!config.public.bugsnagApiKey) {
    console.warn('[Bugsnag] API key not configured, skipping client initialization')
    return
  }

  // Initialize Bugsnag
  Bugsnag.start({
    apiKey: config.public.bugsnagApiKey as string,
    releaseStage: (config.public.bugsnagReleaseStage as string) || 'production',
    appVersion: (config.public.bugsnagAppVersion as string) || '1.0.0',
    enabledReleaseStages: ['production', 'staging'],
    appType: 'browser',

    // Vue plugin for component errors
    plugins: [new BugsnagPluginVue()],

    // Automatic detection
    autoDetectErrors: true,
    autoTrackSessions: true,

    // Context enrichment
    onError: event => {
      // Add app context - use useRouter() instead of nuxtApp.$router for better typing
      try {
        const router = useRouter()
        if (router?.currentRoute?.value) {
          event.addMetadata('app', {
            route: router.currentRoute.value.path,
            routeName: String(router.currentRoute.value.name || 'unknown'),
            routeParams: router.currentRoute.value.params,
          })
        }
      } catch {
        // Router may not be available during initial load
      }

      event.addMetadata('browser', {
        platform: 'web',
        userAgent: navigator.userAgent,
        language: navigator.language,
        online: navigator.onLine,
      })
    },
  })

  // Install Vue error handler
  const bugsnagVue = Bugsnag.getPlugin('vue')
  if (bugsnagVue) {
    nuxtApp.vueApp.use(bugsnagVue)
  }

  // Set user context when Supabase user changes
  const user = useSupabaseUser()
  watch(
    user,
    newUser => {
      if (newUser) {
        Bugsnag.setUser(newUser.id, newUser.email || undefined)
      } else {
        Bugsnag.setUser(undefined, undefined, undefined)
      }
    },
    { immediate: true }
  )

  // Hook into app errors
  nuxtApp.hook('app:error', error => {
    if (Bugsnag.isStarted()) {
      Bugsnag.notify(error instanceof Error ? error : new Error(String(error)))
    }
  })

  // Hook into Vue errors
  nuxtApp.hook('vue:error', (error, instance, info) => {
    if (Bugsnag.isStarted()) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      Bugsnag.notify(errorObj, event => {
        event.addMetadata('vue', {
          component: instance?.$options?.name || 'Unknown',
          info,
        })
      })
    }
  })

  console.log('[Bugsnag] Client-side error tracking initialized')

  // Provide Bugsnag to components
  return {
    provide: {
      bugsnag: Bugsnag,
    },
  }
})
