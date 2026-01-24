# ui-design Specification Delta

## REMOVED Requirements

### Requirement: UI Version Feature Flag
**Reason**: V2 is now the only UI; feature flag infrastructure no longer needed.
**Migration**: Remove `ENABLE_UI_V2` environment variable. V2 components become the standard components.

### Requirement: UI Version Preference System
**Reason**: With only one UI version, user preference between V1/V2 is no longer applicable.
**Migration**: localStorage keys `st-predictor-ui-preference` and `st-predictor-v2-banner-dismissed` can be safely ignored (will be orphaned in users' browsers but cause no harm).

### Requirement: V2 Promo Banner
**Reason**: No longer needed as V2 is the default and only UI.
**Migration**: Remove V2PromoBanner component entirely.

### Requirement: V2 Route Middleware
**Reason**: Route redirect logic between V1 and V2 is no longer needed.
**Migration**: Remove v2-redirect.global.ts middleware. Routes are now direct (no /v2 prefix).

### Requirement: V2 Page Coverage
**Reason**: With V1 removed, there is no separate "V2 version" of pages - all pages are the standard pages.
**Migration**: Pages move from /v2/* to /* routes.

## MODIFIED Requirements

### Requirement: V2 Layout Structure
The layout SHALL provide a sidebar navigation pattern with responsive behavior.

#### Scenario: Desktop viewport layout
- **WHEN** viewport width is 1024px or greater
- **THEN** the sidebar navigation SHALL be visible by default
- **AND** the sidebar MAY be collapsed to icons-only view
- **AND** main content SHALL fill remaining horizontal space

#### Scenario: Tablet viewport layout
- **WHEN** viewport width is between 768px and 1023px
- **THEN** the sidebar SHALL be collapsed by default
- **AND** a hamburger menu SHALL expand the sidebar as an overlay

#### Scenario: Mobile viewport layout
- **WHEN** viewport width is less than 768px
- **THEN** the sidebar SHALL be hidden
- **AND** a bottom navigation bar SHALL provide primary navigation
- **AND** the bottom nav SHALL contain: Dashboard, Current Draw, Analytics, Profile

### Requirement: Quick Stats Dashboard Component
The dashboard SHALL display a quick stats bar with key metrics.

#### Scenario: Quick stats display
- **WHEN** user views the dashboard
- **THEN** the quick stats bar SHALL display:
  - Number of active draws
  - Number of matches pending predictions
  - Number of value opportunities (EV > 3%)
  - Countdown to next close time

### Requirement: Draw Card Component
Draw cards SHALL present draw information in a compact, scannable format.

#### Scenario: Draw card display
- **WHEN** user views the draws list
- **THEN** each draw card SHALL display:
  - Draw number and game type
  - Progress ring showing prediction completion (X/13 or X/8)
  - Close time with countdown
  - Quick action buttons (View, Generate Predictions)
  - Status badge (Open, Closed, Completed)

#### Scenario: Draw card progress ring
- **WHEN** a draw has partial predictions completed
- **THEN** the progress ring SHALL visually indicate completion percentage
- **AND** the ring SHALL use color gradients (red to yellow to green)

### Requirement: Match Card Component
Match cards SHALL present match information with clear visual hierarchy.

#### Scenario: Match card two-column layout
- **WHEN** user views a match card on desktop
- **THEN** the left column SHALL display odds and market data
- **AND** the right column SHALL display AI prediction and actions
- **AND** a tabbed panel SHALL provide access to detailed data

#### Scenario: Match card odds display
- **WHEN** odds are available for a match
- **THEN** the odds ticker SHALL show current odds for 1, X, 2
- **AND** odds movement indicators SHALL show direction
- **AND** color coding SHALL indicate favorable vs unfavorable movement

#### Scenario: Match card prediction panel
- **WHEN** an AI prediction exists for a match
- **THEN** the prediction panel SHALL prominently display:
  - Predicted outcome (1, X, or 2)
  - Confidence level with visual meter
  - Probability distribution (1: X%, X: Y%, 2: Z%)
  - Value opportunity badge if EV > 3%
  - Spik candidate indicator if applicable

### Requirement: Data Tabs Component
Match detail data SHALL be organized in a tabbed interface.

#### Scenario: Data tabs navigation
- **WHEN** user views a match card
- **THEN** tabs SHALL be available for:
  - AI Analysis (reasoning, key factors, similar matches)
  - Statistics (team stats, xG, form)
  - Head-to-Head (historical matchups)
  - Odds Comparison (multi-source odds, market analysis)
  - Model Analysis (Elo ratings, Dixon-Coles probabilities)
- **AND** only one tab panel SHALL be visible at a time
- **AND** tabs with available data SHALL have visual indicator

### Requirement: Mobile Bottom Navigation
Mobile users SHALL have thumb-accessible navigation.

#### Scenario: Bottom navigation visibility
- **WHEN** viewport is mobile-sized (< 768px)
- **THEN** a fixed bottom navigation bar SHALL be visible
- **AND** the bar SHALL contain 4 navigation items with icons and labels

#### Scenario: Bottom navigation items
- **WHEN** mobile bottom nav is displayed
- **THEN** items SHALL include:
  - Dashboard (home icon)
  - Draw (list icon) - navigates to current active draw
  - Analytics (chart icon)
  - Profile (user icon)
- **AND** the active item SHALL be visually highlighted

### Requirement: Sidebar Navigation
Desktop users SHALL have persistent sidebar navigation.

#### Scenario: Sidebar content
- **WHEN** sidebar is visible
- **THEN** it SHALL contain:
  - Logo/brand at top
  - Primary navigation links
  - Recent draws list (last 3)
  - Quick actions section
  - User profile at bottom

#### Scenario: Sidebar collapse
- **WHEN** user clicks the collapse button
- **THEN** sidebar SHALL shrink to icons-only mode
- **AND** navigation labels SHALL be hidden
- **AND** tooltips SHALL appear on hover

### Requirement: Sidebar Toggle Mechanism
The sidebar collapse/expand SHALL be controlled via the header hamburger menu only.

#### Scenario: Sidebar toggle on desktop
- **WHEN** user clicks the hamburger menu icon in the header
- **THEN** the sidebar SHALL toggle between expanded and collapsed states
- **AND** NO separate collapse button SHALL be displayed on the sidebar itself

### Requirement: Dark Mode Support
Components SHALL support both light and dark color modes.

#### Scenario: Dark mode rendering
- **WHEN** system or user preference is dark mode
- **THEN** all components SHALL use dark color tokens
- **AND** contrast requirements SHALL be maintained
- **AND** no component SHALL use hard-coded light colors
