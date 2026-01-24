# Design: Remove UI v1 and Complete V2 Transition

## Context

The ST-Predictor application currently maintains two parallel UI implementations:

1. **V1 UI**: Original implementation using a top-navigation header layout
2. **V2 UI**: Redesigned implementation with sidebar navigation, command palette, and improved match cards

Both UIs are functionally equivalent, with V2 being the modern, production-ready version. The dual implementation was introduced to allow gradual rollout and user testing. With V2 proven stable, maintaining both creates:

- Code duplication across 7 page pairs
- Two sets of layout files
- 19+ V2-prefixed components alongside V1 equivalents
- Feature flag complexity
- Testing overhead (must test both versions)

## Goals

- Remove all V1 UI code (pages, layouts, components)
- Make V2 the only UI, accessible at root routes (no `/v2` prefix)
- Remove all transition infrastructure (feature flags, middleware, preferences)
- Simplify component naming (remove `V2` prefix)

## Non-Goals

- Changing V2 functionality or design
- Adding new features during this transition
- Maintaining backwards compatibility for V1 routes

## Decisions

### Decision 1: Direct removal vs deprecation period

**Chosen**: Direct removal

**Rationale**: V2 has been available for user opt-in. Users who preferred V2 are already using it. The feature flag allows staged rollout in production if needed. A deprecation period adds complexity with no clear benefit.

### Decision 2: Component renaming strategy

**Chosen**: Remove `V2` prefix from all components

**Rationale**:
- Components like `V2MatchCard`, `V2DrawCard` become `MatchCard`, `DrawCard`
- Some V1 components with same base name (e.g., `AppHeader`) will be replaced
- Clear naming without version suffixes

**Migration mapping**:
| Old Name | New Name |
|----------|----------|
| V2AppHeader | AppHeader |
| V2AppSidebar | AppSidebar |
| V2AppBreadcrumb | AppBreadcrumb |
| V2MatchCard | MatchCard (replaces existing) |
| V2DrawCard | DrawCard |
| V2CommandPalette | CommandPalette |
| V2MobileBottomNav | MobileBottomNav |
| V2QuickStats | QuickStats |
| V2ProgressRing | ProgressRing |
| V2DataTabs | DataTabs |
| V2OddsTicker | OddsTicker |
| V2PredictionPanel | PredictionPanel |
| V2ConfidenceMeter | ConfidenceMeter |
| V2ValueBadge | ValueBadge |
| V2Statistics | Statistics |
| V2HeadToHead | HeadToHead |
| V2OddsComparison | OddsComparison |
| V2AIAnalysis | AIAnalysis |
| V2SkeletonCard | SkeletonCard |

### Decision 3: Layout consolidation

**Chosen**: Replace `default.vue` with contents of `v2.vue`

**Rationale**: The v2 layout becomes the default (and only) layout. The v1 default layout is removed.

### Decision 4: CSS consolidation

**Chosen**: Merge relevant v2.css styles into main.css, remove v2.css

**Rationale**: Single CSS entry point is simpler. V2-specific styles should be in main.css since V2 is now the only UI.

### Decision 5: Route handling

**Chosen**: No redirect middleware for old V2 routes

**Rationale**:
- V1 routes simply won't exist (404)
- Old `/v2/*` routes won't have redirects (bookmarks break, but clean codebase)
- Users can update bookmarks; the app is not public-facing

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Broken bookmarks | Low | Internal tool; users can update bookmarks |
| Missed component references | Medium | grep/search for V2 prefix before completing |
| Test coverage gaps | Medium | Update e2e tests to use new routes |

## Migration Plan

### Phase 1: Remove V1 pages
1. Delete V1 pages: `pages/index.vue`, `pages/analytics.vue`, `pages/ai-dashboard.vue`, `pages/performance.vue`, `pages/admin.vue`
2. Delete V1 draw pages: `pages/draw/[id]/index.vue`, `pages/draw/[id]/optimize.vue`
3. Delete V1 draw directory: `pages/draw/`

### Phase 2: Move V2 pages to root
1. Move `pages/v2/index.vue` to `pages/index.vue`
2. Move `pages/v2/analytics.vue` to `pages/analytics.vue`
3. Move `pages/v2/ai-dashboard.vue` to `pages/ai-dashboard.vue`
4. Move `pages/v2/performance.vue` to `pages/performance.vue`
5. Move `pages/v2/admin.vue` to `pages/admin.vue`
6. Move `pages/v2/draw/[id]/index.vue` to `pages/draw/[id]/index.vue`
7. Move `pages/v2/draw/[id]/optimize.vue` to `pages/draw/[id]/optimize.vue`
8. Remove empty `pages/v2/` directory

### Phase 3: Update layout
1. Replace `layouts/default.vue` with contents from `layouts/v2.vue`
2. Delete `layouts/v2.vue`
3. Update any `definePageMeta({ layout: 'v2' })` calls in pages to use default

### Phase 4: Rename and move components
1. Move all `components/v2/*.vue` to `components/`
2. Rename to remove `V2` prefix
3. Delete old V1 components: `AppHeader.vue`, `AppBreadcrumb.vue`, `V2PromoBanner.vue`
4. Update all component references across the codebase

### Phase 5: Remove transition infrastructure
1. Delete `middleware/v2-redirect.global.ts`
2. Delete `composables/useUIVersion.ts`
3. Remove `ENABLE_UI_V2` from `nuxt.config.ts`
4. Remove `ENABLE_UI_V2` from `.env.example`

### Phase 6: Consolidate CSS
1. Merge `v2.css` content into `main.css`
2. Delete `assets/css/v2.css`
3. Update CSS imports in `nuxt.config.ts` if needed

### Phase 7: Update tests
1. Delete `tests/unit/composables/useUIVersion.test.ts`
2. Update `tests/e2e/v2-ui.spec.ts` to test new root routes
3. Rename e2e test file to remove v2 reference

### Rollback

If issues arise:
1. Git revert the commits
2. Re-enable ENABLE_UI_V2 flag
3. V1 routes restored from git history

## Open Questions

None - the approach is straightforward file reorganization and cleanup.
