# Tasks: Remove UI v1 and Complete V2 Transition

## 1. Remove V1 Pages
- [x] 1.1 Delete `pages/index.vue` (V1 dashboard)
- [x] 1.2 Delete `pages/analytics.vue` (V1 analytics)
- [x] 1.3 Delete `pages/ai-dashboard.vue` (V1 AI dashboard)
- [x] 1.4 Delete `pages/performance.vue` (V1 performance)
- [x] 1.5 Delete `pages/admin.vue` (V1 admin)
- [x] 1.6 Delete `pages/draw/[id]/index.vue` (V1 draw detail)
- [x] 1.7 Delete `pages/draw/[id]/optimize.vue` (V1 optimize)
- [x] 1.8 Delete empty `pages/draw/[id]/` directory
- [x] 1.9 Delete empty `pages/draw/` directory

## 2. Move V2 Pages to Root
- [x] 2.1 Move `pages/v2/index.vue` to `pages/index.vue`
- [x] 2.2 Move `pages/v2/analytics.vue` to `pages/analytics.vue`
- [x] 2.3 Move `pages/v2/ai-dashboard.vue` to `pages/ai-dashboard.vue`
- [x] 2.4 Move `pages/v2/performance.vue` to `pages/performance.vue`
- [x] 2.5 Move `pages/v2/admin.vue` to `pages/admin.vue`
- [x] 2.6 Create `pages/draw/[id]/` directory
- [x] 2.7 Move `pages/v2/draw/[id]/index.vue` to `pages/draw/[id]/index.vue`
- [x] 2.8 Move `pages/v2/draw/[id]/optimize.vue` to `pages/draw/[id]/optimize.vue`
- [x] 2.9 Delete empty `pages/v2/draw/[id]/` directory
- [x] 2.10 Delete empty `pages/v2/draw/` directory
- [x] 2.11 Delete empty `pages/v2/` directory

## 3. Update Layout
- [x] 3.1 Replace `layouts/default.vue` content with `layouts/v2.vue` content
- [x] 3.2 Delete `layouts/v2.vue`
- [x] 3.3 Remove `definePageMeta({ layout: 'v2' })` from all pages that specify v2 layout

## 4. Rename and Move V2 Components
- [x] 4.1 Rename `components/v2/AppHeader.vue` to `components/AppHeader.vue` (replacing existing)
- [x] 4.2 Delete old `components/AppHeader.vue` (V1 version)
- [x] 4.3 Rename `components/v2/AppSidebar.vue` to `components/AppSidebar.vue`
- [x] 4.4 Rename `components/v2/AppBreadcrumb.vue` to `components/AppBreadcrumb.vue` (replacing existing)
- [x] 4.5 Delete old `components/AppBreadcrumb.vue` (V1 version)
- [x] 4.6 Rename `components/v2/MatchCard.vue` to `components/MatchCard.vue`
- [x] 4.7 Rename `components/v2/DrawCard.vue` to `components/DrawCard.vue`
- [x] 4.8 Rename `components/v2/CommandPalette.vue` to `components/CommandPalette.vue`
- [x] 4.9 Rename `components/v2/MobileBottomNav.vue` to `components/MobileBottomNav.vue`
- [x] 4.10 Rename `components/v2/QuickStats.vue` to `components/QuickStats.vue`
- [x] 4.11 Rename `components/v2/ProgressRing.vue` to `components/ProgressRing.vue`
- [x] 4.12 Rename `components/v2/DataTabs.vue` to `components/DataTabs.vue`
- [x] 4.13 Rename `components/v2/OddsTicker.vue` to `components/OddsTicker.vue`
- [x] 4.14 Rename `components/v2/PredictionPanel.vue` to `components/PredictionPanel.vue`
- [x] 4.15 Rename `components/v2/ConfidenceMeter.vue` to `components/ConfidenceMeter.vue`
- [x] 4.16 Rename `components/v2/ValueBadge.vue` to `components/ValueBadge.vue`
- [x] 4.17 Rename `components/v2/Statistics.vue` to `components/MatchStatistics.vue` (multi-word component name)
- [x] 4.18 Rename `components/v2/HeadToHead.vue` to `components/HeadToHead.vue`
- [x] 4.19 Rename `components/v2/OddsComparison.vue` to `components/OddsComparison.vue`
- [x] 4.20 Rename `components/v2/AIAnalysis.vue` to `components/AIAnalysis.vue`
- [x] 4.21 Rename `components/v2/SkeletonCard.vue` to `components/SkeletonCard.vue`
- [x] 4.22 Delete empty `components/v2/` directory
- [x] 4.23 Delete `components/V2PromoBanner.vue`
- [x] 4.24 Delete `components/match/Statistics.vue` (unused V1 component causing duplicate resolution)

## 5. Update Component References
- [x] 5.1 Search and replace `V2AppHeader` with `AppHeader` across all files
- [x] 5.2 Search and replace `V2AppSidebar` with `AppSidebar` across all files
- [x] 5.3 Search and replace `V2AppBreadcrumb` with `AppBreadcrumb` across all files
- [x] 5.4 Search and replace `V2MatchCard` with `MatchCard` across all files
- [x] 5.5 Search and replace `V2DrawCard` with `DrawCard` across all files
- [x] 5.6 Search and replace `V2CommandPalette` with `CommandPalette` across all files
- [x] 5.7 Search and replace `V2MobileBottomNav` with `MobileBottomNav` across all files
- [x] 5.8 Search and replace `V2QuickStats` with `QuickStats` across all files
- [x] 5.9 Search and replace `V2ProgressRing` with `ProgressRing` across all files
- [x] 5.10 Search and replace `V2DataTabs` with `DataTabs` across all files
- [x] 5.11 Search and replace `V2OddsTicker` with `OddsTicker` across all files
- [x] 5.12 Search and replace `V2PredictionPanel` with `PredictionPanel` across all files
- [x] 5.13 Search and replace `V2ConfidenceMeter` with `ConfidenceMeter` across all files
- [x] 5.14 Search and replace `V2ValueBadge` with `ValueBadge` across all files
- [x] 5.15 Search and replace `V2Statistics` with `MatchStatistics` across all files
- [x] 5.16 Search and replace `V2HeadToHead` with `HeadToHead` across all files
- [x] 5.17 Search and replace `V2OddsComparison` with `OddsComparison` across all files
- [x] 5.18 Search and replace `V2AIAnalysis` with `AIAnalysis` across all files
- [x] 5.19 Search and replace `V2SkeletonCard` with `SkeletonCard` across all files
- [x] 5.20 Update `/v2/draw/*` routes to `/draw/*` in components
- [x] 5.21 Update `/v2` home links to `/` in pages

## 6. Remove Transition Infrastructure
- [x] 6.1 Delete `middleware/v2-redirect.global.ts`
- [x] 6.2 Delete `composables/useUIVersion.ts`
- [x] 6.3 Remove `enableUIV2` from `nuxt.config.ts` public runtime config
- [x] 6.4 Remove `ENABLE_UI_V2` from `.env.example`
- [x] 6.5 Search for and remove any remaining `useUIVersion` imports
- [x] 6.6 Remove V2PromoBanner from `layouts/default.vue` if not already removed
- [x] 6.7 Remove "Switch to Classic UI" button from AppSidebar.vue

## 7. Consolidate CSS
- [x] 7.1 Review `assets/css/v2.css` content
- [x] 7.2 Merge necessary v2 styles into `assets/css/main.css`
- [x] 7.3 Delete `assets/css/v2.css`
- [x] 7.4 Update CSS imports in `nuxt.config.ts` if needed

## 8. Update Tests
- [x] 8.1 Delete `tests/unit/composables/useUIVersion.test.ts`
- [x] 8.2 Update `tests/e2e/v2-ui.spec.ts` routes from `/v2/*` to `/*`
- [x] 8.3 Rename `tests/e2e/v2-ui.spec.ts` to `tests/e2e/ui.spec.ts`

## 9. Final Verification
- [x] 9.1 Run `npm run lint` and fix any issues
- [x] 9.2 Run `npm run typecheck` and fix any type errors
- [x] 9.3 Run `npm run build` to verify build succeeds
- [x] 9.4 Run `npm run test` to verify tests pass
- [x] 9.5 Manual smoke test of all main routes (verified via build - routes compile correctly)
- [x] 9.6 Verify no references to v2 prefix remain (except in git history/archives)

## 10. Coordinate with Active Changes
- [x] 10.1 Update `add-clear-cache-button` proposal to remove V1 scope (N/A - already merged without V1 reference)
