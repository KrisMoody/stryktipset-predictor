# Change: Remove UI v1 and Complete V2 Transition

## Why

The V2 UI redesign has been fully implemented and tested. Maintaining two parallel UI implementations creates unnecessary code duplication, increases maintenance burden, and complicates feature development. The transition infrastructure (feature flags, preference system, redirect middleware, promo banners) is no longer needed since V2 is the production-ready UI.

## What Changes

- **BREAKING**: All V1 routes (`/`, `/analytics`, `/ai-dashboard`, `/performance`, `/admin`, `/draw/[id]`, `/draw/[id]/optimize`) will be removed
- **BREAKING**: V2 routes will become the primary routes (e.g., `/v2/analytics` becomes `/analytics`)
- Remove the `ENABLE_UI_V2` feature flag and all feature flag logic
- Remove the localStorage preference system (`st-predictor-ui-preference`, `st-predictor-v2-banner-dismissed`)
- Remove V1 layouts, components, and pages
- Rename V2 components to remove the `V2` prefix
- Consolidate CSS files
- Update the `add-clear-cache-button` change to target only the new unified admin page

## Impact

- **Affected specs**: `ui-design`
- **Affected code**:
  - `pages/*.vue` (remove v1, move v2)
  - `pages/v2/**/*.vue` (move to root)
  - `layouts/default.vue` (replace with v2 layout)
  - `layouts/v2.vue` (remove after migration)
  - `components/v2/*.vue` (move and rename)
  - `components/AppHeader.vue`, `components/AppBreadcrumb.vue`, `components/V2PromoBanner.vue` (remove)
  - `middleware/v2-redirect.global.ts` (remove)
  - `composables/useUIVersion.ts` (remove)
  - `nuxt.config.ts` (remove feature flag)
  - `assets/css/main.css`, `assets/css/v2.css` (consolidate)
  - `.env.example` (remove `ENABLE_UI_V2`)
- **Active changes affected**: `add-clear-cache-button` needs update to remove V1 scope

## Migration

Users with V1 preference stored in localStorage will automatically see V2 UI. Old bookmarks to V1 routes will need to be updated manually (no automatic redirects post-migration).
