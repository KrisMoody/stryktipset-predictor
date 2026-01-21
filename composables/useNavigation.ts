export interface NavigationItem {
  label: string
  to: string
  icon?: string
  adminOnly?: boolean
}

export interface BreadcrumbItem {
  label: string
  to?: string
  icon?: string
}

export function useNavigation() {
  const route = useRoute()
  const { isAdmin } = useUserProfile()

  // Check if we're in V2 mode
  const isV2Route = computed(() => route.path.startsWith('/v2'))

  // Base path prefix for V2 routes
  const pathPrefix = computed(() => (isV2Route.value ? '/v2' : ''))

  const allNavItems: NavigationItem[] = [
    { label: 'Dashboard', to: '/', icon: 'i-heroicons-home' },
    { label: 'Analytics', to: '/analytics', icon: 'i-heroicons-chart-bar' },
    { label: 'AI Metrics', to: '/ai-dashboard', icon: 'i-heroicons-cpu-chip' },
    { label: 'Performance', to: '/performance', icon: 'i-heroicons-chart-pie' },
    { label: 'Admin', to: '/admin', icon: 'i-heroicons-cog-6-tooth', adminOnly: true },
  ]

  // V2-specific nav items - all use V2 routes
  const v2NavItems: NavigationItem[] = [
    { label: 'Dashboard', to: '/v2', icon: 'i-heroicons-home' },
    { label: 'Analytics', to: '/v2/analytics', icon: 'i-heroicons-chart-bar' },
    { label: 'AI Metrics', to: '/v2/ai-dashboard', icon: 'i-heroicons-cpu-chip' },
    { label: 'Performance', to: '/v2/performance', icon: 'i-heroicons-chart-pie' },
    { label: 'Admin', to: '/v2/admin', icon: 'i-heroicons-cog-6-tooth', adminOnly: true },
  ]

  const mainNavItems = computed(() => {
    const items = isV2Route.value ? v2NavItems : allNavItems
    return items.filter(item => !item.adminOnly || isAdmin.value)
  })

  const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const path = route.path
    const prefix = pathPrefix.value
    const dashboardPath = prefix || '/'
    const items: BreadcrumbItem[] = [
      { label: 'Dashboard', to: dashboardPath, icon: 'i-heroicons-home' },
    ]

    // Don't show breadcrumbs on root
    if (path === '/' || path === '/v2') {
      return []
    }

    // Strip /v2 prefix for matching
    const normalizedPath = path.replace(/^\/v2/, '') || '/'

    // Static pages
    if (normalizedPath === '/analytics') {
      items.push({ label: 'Analytics' })
    } else if (normalizedPath === '/ai-dashboard') {
      items.push({ label: 'AI Metrics' })
    } else if (normalizedPath === '/performance') {
      items.push({ label: 'Performance' })
    } else if (normalizedPath === '/admin') {
      items.push({ label: 'Admin' })
    }
    // Dynamic draw pages
    else if (normalizedPath.match(/^\/draw\/\d+$/)) {
      const drawId = route.params.id
      items.push({ label: `Draw #${drawId}` })
    } else if (normalizedPath.match(/^\/draw\/\d+\/optimize$/)) {
      const drawId = route.params.id
      items.push({ label: `Draw #${drawId}`, to: `${prefix}/draw/${drawId}` })
      items.push({ label: 'Optimize Coupon' })
    }

    return items
  })

  // Helper to generate a route path respecting current UI mode
  function getRoutePath(basePath: string): string {
    if (isV2Route.value && !basePath.startsWith('/v2')) {
      return `/v2${basePath}`
    }
    return basePath
  }

  return {
    mainNavItems,
    breadcrumbItems,
    isV2Route,
    pathPrefix,
    getRoutePath,
  }
}
