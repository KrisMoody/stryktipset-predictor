## Context

The st-predictor application has evolved rapidly with features added faster than UI design could keep pace. The current interface serves its function but lacks the polish and efficiency expected of a modern sports prediction platform.

**Stakeholders**: End users (bettors), administrators
**Constraints**:
- Must not break existing functionality
- Must work with existing Nuxt UI component library
- Must maintain accessibility compliance (WCAG 2 AA)
- Must be fully responsive (mobile-first)

## Goals / Non-Goals

### Goals
1. Improve information hierarchy - prioritize actionable data (predictions, value opportunities, odds)
2. Reduce cognitive load - fewer visible elements, progressive disclosure
3. Enhance mobile UX - touch-optimized interactions, better responsive behavior
4. Add power user features - keyboard navigation, command palette
5. Maintain design consistency - unified design language across all views
6. Enable A/B testing - feature flag allows gradual rollout and comparison

### Non-Goals
1. **Not** changing backend APIs or data models
2. **Not** modifying the statistical calculation system
3. **Not** adding new betting features or prediction algorithms
4. **Not** creating a design system from scratch (leverage Nuxt UI)
5. **Not** deprecating the current UI (v1 remains default)

## Decisions

### Decision 1: Feature Flag Architecture
**What**: Gate all v2 components behind `ENABLE_UI_V2` runtime config flag
**Why**:
- Zero risk to production users
- Enables side-by-side comparison during development
- Allows per-environment rollout (staging first)
- Easy rollback if issues discovered

**Implementation**:
```typescript
// nuxt.config.ts
runtimeConfig: {
  public: {
    enableUIV2: process.env.ENABLE_UI_V2 === 'true',
  }
}

// composables/useUIVersion.ts
export function useUIVersion() {
  const config = useRuntimeConfig()
  return {
    isV2: computed(() => config.public.enableUIV2),
  }
}
```

### Decision 2: Component Directory Structure
**What**: Create parallel `components/v2/` directory rather than modifying existing components
**Why**:
- Complete isolation from v1 components
- No merge conflicts during development
- Can share base utilities while having different implementations
- Cleaner migration path when v2 becomes default

**Alternatives considered**:
- Props-based versioning (rejected: too complex, pollutes component APIs)
- Slot-based composition (rejected: doesn't address structural differences)

### Decision 3: Layout Strategy
**What**: New `layouts/v2.vue` with sidebar navigation
**Why**:
- Current top-nav doesn't scale well with more features
- Sidebar provides persistent navigation context
- Better use of horizontal space on desktop
- Industry standard for dashboard applications

**Structure**:
```
┌─────────────────────────────────────────┐
│  Header (compact)                       │
├────────┬────────────────────────────────┤
│        │                                │
│ Sidebar│     Main Content               │
│  Nav   │                                │
│        │                                │
│        │                                │
├────────┴────────────────────────────────┤
│  Mobile Bottom Nav (responsive)         │
└─────────────────────────────────────────┘
```

### Decision 4: Match Card Redesign
**What**: Two-column layout with focused data presentation
**Why**: Current card has too many expandable sections competing for attention

**New Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│  #1  Home Team vs Away Team                  Kickoff Time    │
│       League • Country                       [Predict] [More]│
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌────────────────────────────────┐ │
│  │    ODDS DISPLAY     │  │     AI PREDICTION              │ │
│  │  1: 2.10  X: 3.40   │  │  Predicted: 1 (High)           │ │
│  │  2: 3.50            │  │  [========] 72%                │ │
│  │  ↑0.05   ─    ↓0.10 │  │                                │ │
│  │                     │  │  Value: +5.2% EV on Home       │ │
│  └─────────────────────┘  └────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  [Analysis] [Statistics] [H2H] [Odds] [Model]  ← Tabs        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Tab Content Panel                         │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Decision 5: Color Tokens for Value Visualization
**What**: Semantic color scale for Expected Value indicators
**Why**: Quick visual scanning for betting opportunities

**Tokens**:
```css
--ev-negative: var(--ui-color-red-500);      /* EV < 0% */
--ev-neutral: var(--ui-color-gray-500);       /* 0% ≤ EV < 3% */
--ev-opportunity: var(--ui-color-green-500);  /* 3% ≤ EV < 5% */
--ev-strong: var(--ui-color-emerald-500);     /* 5% ≤ EV < 10% */
--ev-exceptional: var(--ui-color-amber-500);  /* EV ≥ 10% */
```

### Decision 6: Mobile Navigation Pattern
**What**: Bottom navigation bar with 4 primary actions
**Why**:
- Thumb-reachable on large phones
- Standard mobile pattern (iOS tab bar, Android bottom nav)
- Reduces need for hamburger menu

**Items**:
1. Dashboard (home)
2. Current Draw (if active)
3. Analytics
4. Settings/Profile

### Decision 7: Command Palette Implementation
**What**: Keyboard-triggered search/action overlay (Cmd+K / Ctrl+K)
**Why**:
- Power user productivity
- Quick navigation without mouse
- Modern developer tool convention
- Reduces navigation clicks

**Actions**:
- Navigate to draw by number
- Navigate to match
- Trigger prediction
- Switch game type
- Toggle dark mode

## Risks / Trade-offs

### Risk 1: Increased Bundle Size
**Impact**: Medium
**Mitigation**:
- Code-split v2 components (lazy load)
- Tree-shake unused components
- Monitor bundle analyzer during development

### Risk 2: User Confusion with Two UIs
**Impact**: Low (flag is off by default)
**Mitigation**:
- Clear documentation
- Only enable for beta testers initially
- Provide toggle in UI for easy comparison

### Risk 3: Maintenance of Two Component Sets
**Impact**: Medium
**Mitigation**:
- Share business logic via composables
- Clear deprecation timeline once v2 stabilized
- Automated tests for both versions

## Migration Plan

### Phase 1: Foundation (Tasks 1.1-1.5)
- Feature flag setup
- Directory structure
- Base layout
- Design tokens

### Phase 2: Core Components (Tasks 2.1-2.8)
- QuickStats
- DrawCard v2
- MatchCard v2
- Prediction panels
- Odds displays

### Phase 3: Navigation (Tasks 3.1-3.4)
- Sidebar navigation
- Command palette
- Mobile bottom nav
- Breadcrumbs

### Phase 4: Polish (Tasks 4.1-4.4)
- Animations/transitions
- Loading states
- Error boundaries
- Accessibility audit

### Rollback
```bash
# Disable v2 UI
ENABLE_UI_V2=false
```
No database migrations or destructive changes - rollback is instant.

## Open Questions

1. **Timeline view priority**: Should timeline view be included in v2.0 or deferred?
   - *Recommendation*: Defer to v2.1, focus on card redesign first

2. **Dark mode tokens**: Should we introduce new semantic tokens for v2 or reuse existing?
   - *Recommendation*: Reuse existing Nuxt UI tokens where possible, add v2-specific only when needed

3. **Animation library**: Use CSS transitions, Vue transitions, or a library like Motion One?
   - *Recommendation*: Vue transitions for component enter/leave, CSS for micro-interactions
