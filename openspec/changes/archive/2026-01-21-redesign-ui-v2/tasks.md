## 1. Foundation & Infrastructure

- [x] 1.1 Add `ENABLE_UI_V2` feature flag to `nuxt.config.ts` runtime config
- [x] 1.2 Create `composables/useUIVersion.ts` for feature flag access
- [x] 1.3 Create `layouts/v2.vue` with sidebar navigation structure
- [x] 1.4 Create `assets/css/v2.css` with v2-specific design tokens
- [x] 1.5 Create `components/v2/` directory structure
- [x] 1.6 Create `middleware/v2-redirect.global.ts` for automatic V2 routing
- [x] 1.7 Extend `useUIVersion.ts` with localStorage preference management

## 2. Core Components

- [x] 2.1 Create `components/v2/QuickStats.vue` - Key metrics bar for dashboard
- [x] 2.2 Create `components/v2/ProgressRing.vue` - Draw completion visualization
- [x] 2.3 Create `components/v2/DrawCard.vue` - Redesigned compact draw card
- [x] 2.4 Create `components/v2/OddsTicker.vue` - Live odds with movement indicators
- [x] 2.5 Create `components/v2/ConfidenceMeter.vue` - Visual confidence gauge
- [x] 2.6 Create `components/v2/ValueBadge.vue` - EV opportunity badges
- [x] 2.7 Create `components/v2/PredictionPanel.vue` - Prominent AI prediction display
- [x] 2.8 Create `components/v2/MatchCard.vue` - Two-column match layout with tabs

## 3. Navigation Components

- [x] 3.1 Create `components/v2/AppSidebar.vue` - Collapsible sidebar navigation
- [x] 3.2 Create `components/v2/AppHeader.vue` - Compact header with search
- [x] 3.3 Create `components/v2/CommandPalette.vue` - Keyboard navigation overlay
- [x] 3.4 Create `components/v2/MobileBottomNav.vue` - Mobile navigation bar
- [x] 3.5 Create `components/v2/AppBreadcrumb.vue` - Enhanced breadcrumbs

## 4. Data Display Components

- [x] 4.1 Create `components/v2/DataTabs.vue` - Tabbed interface for match data
- [x] 4.2 Create `components/v2/OddsComparison.vue` - Multi-source odds table
- [x] 4.3 Create `components/v2/AIAnalysis.vue` - Formatted AI reasoning display
- [x] 4.4 Create `components/v2/Statistics.vue` - Team statistics panels
- [x] 4.5 Create `components/v2/HeadToHead.vue` - H2H match history

## 5. Page Updates

- [x] 5.1 Create `pages/v2/index.vue` - Redesigned dashboard
- [x] 5.2 Create `pages/v2/draw/[id]/index.vue` - Redesigned draw detail
- [x] 5.3 Create `pages/v2/draw/[id]/optimize.vue` - Redesigned coupon optimization
- [x] 5.4 Update pages to use v2 layout via `definePageMeta({ layout: 'v2' })`
- [x] 5.5 Create `pages/v2/analytics.vue` - Analytics page with V2 layout
- [x] 5.6 Create `pages/v2/ai-dashboard.vue` - AI Metrics Dashboard with V2 layout
- [x] 5.7 Create `pages/v2/performance.vue` - Performance page with V2 layout
- [x] 5.8 Create `pages/v2/admin.vue` - Admin Control Panel with V2 layout

## 6. Polish & Accessibility

- [x] 6.1 Add enter/leave transitions to v2 components
- [x] 6.2 Implement skeleton loading states for v2 cards
- [x] 6.3 Add keyboard shortcuts documentation
- [x] 6.4 Audit WCAG 2 AA compliance for all v2 components
- [x] 6.5 Test responsive behavior on mobile devices
- [x] 6.6 Add dark mode support to all v2 components

## 7. Documentation & Testing

- [x] 7.1 Update .env.example with v2 feature flag documentation
- [x] 7.2 Add v2 components to Playwright visual regression tests
- [x] 7.3 Write unit tests for useUIVersion composable

## 8. User Preference & Opt-In System

- [x] 8.1 Create `components/V2PromoBanner.vue` - Banner to try new UI
- [x] 8.2 Add V2 promo banner to default layout
- [x] 8.3 Implement localStorage-based UI preference storage
- [x] 8.4 Add "Switch to Classic UI" button in V2 sidebar
- [x] 8.5 Update `useNavigation.ts` with V2-aware navigation routes
- [x] 8.6 Remove redundant sidebar collapse chevron button (use header hamburger only)
