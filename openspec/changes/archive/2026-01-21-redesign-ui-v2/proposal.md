# Change: Redesign UI v2 - Modern Sports Betting Dashboard

## Why

The current UI has grown organically with rapid feature additions, leading to:
1. **Information density issues**: Match cards are cluttered with expandable sections, buttons, and data competing for attention
2. **Navigation friction**: Users need multiple clicks to access key information (odds comparison, AI analysis, model analysis)
3. **Inconsistent information hierarchy**: Critical betting data (odds, predictions, value opportunities) isn't prioritized visually
4. **Mobile experience degradation**: Dense grids don't adapt well to smaller screens
5. **Lack of personalization**: All users see the same layout regardless of their betting style or preferences

Research into modern sports betting UX (FanDuel, DraftKings, bet365, Pinnacle) reveals key patterns:
- Quick-scan layouts with essential data upfront
- Progressive disclosure for detailed analysis
- Real-time visual feedback for odds changes
- Clear visual hierarchy emphasizing actionable items (value opportunities, predictions)
- Streamlined bet slip / coupon workflows

## What Changes

### Core Architecture
- **Feature flag**: `ENABLE_UI_V2=true` - all changes gated behind this flag
- **New layout**: `layouts/v2.vue` - sidebar navigation + command palette
- **Component library**: New `components/v2/` directory with redesigned components
- **CSS module**: `assets/css/v2.css` - new design tokens and utilities
- **User preference**: localStorage-based opt-in/opt-out system with promo banner
- **Route middleware**: `middleware/v2-redirect.global.ts` for automatic V2 routing

### Dashboard Redesign
- **Quick Stats Bar**: At-a-glance metrics (active draws, pending predictions, value opportunities)
- **Draw Cards v2**: Compact preview with progress ring, key metrics, and quick actions
- **Timeline View**: Alternative chronological view of upcoming matches

### Match View Redesign
- **Match Card v2**: Two-column layout with odds/prediction left, actions right
- **Data Tabs**: Tabbed interface replacing expandable accordion sections
- **Odds Ticker**: Live odds display with movement indicators and sparklines
- **Prediction Panel**: Prominent AI prediction with confidence visualization
- **Value Indicator**: Visual badge system for EV opportunities (3%+, 5%+, 10%+)

### Navigation Redesign
- **Sidebar Nav**: Collapsible sidebar with quick links and recent draws (toggle via header hamburger)
- **Command Palette**: Keyboard-driven navigation (Cmd+K) for power users
- **Breadcrumb Trail**: Enhanced breadcrumbs with draw/match context
- **V2 Navigation**: All sidebar links point to V2 routes when in V2 mode

### User Preference System
- **Promo Banner**: "Try New UI" banner on V1 pages for users who haven't chosen
- **Opt-in Storage**: localStorage preference (`st-predictor-ui-preference`)
- **Auto Redirect**: Middleware redirects opted-in users to V2 routes
- **Opt-out**: "Switch to Classic UI" button in V2 sidebar

### New Components
- `ConfidenceMeter` - Visual confidence gauge (0-100%)
- `OddsTicker` - Live odds with movement animation
- `ValueBadge` - EV opportunity badges
- `ProgressRing` - Draw completion visualization
- `QuickStats` - Key metrics bar
- `MatchTimeline` - Chronological match view
- `DataTabs` - Tabbed data panels
- `CommandPalette` - Keyboard navigation overlay
- `V2PromoBanner` - Opt-in banner for classic UI users

### V2 Page Coverage
All primary pages have V2 versions:
- `/v2` - Dashboard
- `/v2/analytics` - Prediction Analytics
- `/v2/ai-dashboard` - AI Metrics Dashboard
- `/v2/performance` - System Performance
- `/v2/admin` - Admin Control Panel
- `/v2/draw/[id]` - Draw Detail
- `/v2/draw/[id]/optimize` - Coupon Optimization

### Mobile Optimization
- Bottom navigation bar for primary actions
- Swipeable match cards
- Collapsible data sections optimized for touch
- Full-screen prediction detail view

## Impact

- **Affected specs**: None (new capability, no existing specs modified)
- **Affected code**:
  - `layouts/` - New v2 layout
  - `components/` - New v2 component directory + V2PromoBanner
  - `pages/` - Full V2 page coverage (dashboard, analytics, ai-dashboard, performance, admin, draw detail, optimize)
  - `assets/css/` - New v2 stylesheet
  - `composables/` - Extended useUIVersion with localStorage preference, useNavigation with V2 routes
  - `middleware/` - v2-redirect.global.ts for automatic routing
  - `nuxt.config.ts` - Feature flag configuration
- **Backward compatibility**: 100% - existing UI unchanged when flag is off
- **Risk**: Low - isolated behind feature flag, no breaking changes
