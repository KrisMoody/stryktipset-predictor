export interface NavigationItem {
  label: string
  to: string
  icon?: string
}

export interface BreadcrumbItem {
  label: string
  to?: string
  icon?: string
}

export function useNavigation() {
  const route = useRoute()

  const mainNavItems: NavigationItem[] = [
    { label: 'Dashboard', to: '/', icon: 'i-heroicons-home' },
    { label: 'Analytics', to: '/analytics', icon: 'i-heroicons-chart-bar' },
    { label: 'AI Metrics', to: '/ai-dashboard', icon: 'i-heroicons-cpu-chip' },
    { label: 'Performance', to: '/performance', icon: 'i-heroicons-chart-pie' },
    { label: 'Admin', to: '/admin', icon: 'i-heroicons-cog-6-tooth' },
  ]

  const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [{ label: 'Dashboard', to: '/', icon: 'i-heroicons-home' }]

    const path = route.path

    // Don't show breadcrumbs on root
    if (path === '/') {
      return []
    }

    // Static pages
    if (path === '/analytics') {
      items.push({ label: 'Analytics' })
    } else if (path === '/ai-dashboard') {
      items.push({ label: 'AI Metrics' })
    } else if (path === '/performance') {
      items.push({ label: 'Performance' })
    } else if (path === '/admin') {
      items.push({ label: 'Admin' })
    }
    // Dynamic draw pages
    else if (path.match(/^\/draw\/\d+$/)) {
      const drawId = route.params.id
      items.push({ label: `Draw #${drawId}` })
    } else if (path.match(/^\/draw\/\d+\/optimize$/)) {
      const drawId = route.params.id
      items.push({ label: `Draw #${drawId}`, to: `/draw/${drawId}` })
      items.push({ label: 'Optimize Coupon' })
    }

    return items
  })

  return {
    mainNavItems,
    breadcrumbItems,
  }
}
