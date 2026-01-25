# ui-design Specification

## Purpose
TBD - created by archiving change redesign-ui-v2. Update Purpose after archive.
## Requirements
### Requirement: UI Version Feature Flag
The system SHALL support a runtime feature flag `ENABLE_UI_V2` that controls which UI version is displayed.

#### Scenario: V2 UI enabled
- **WHEN** `ENABLE_UI_V2=true` in environment configuration
- **THEN** the application SHALL render the v2 layout and components
- **AND** the sidebar navigation SHALL be visible on desktop viewports

#### Scenario: V2 UI disabled (default)
- **WHEN** `ENABLE_UI_V2` is not set or is `false`
- **THEN** the application SHALL render the original v1 layout and components
- **AND** no v2-specific code SHALL be loaded

### Requirement: V2 Layout Structure
The v2 layout SHALL provide a sidebar navigation pattern with responsive behavior.

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

### Requirement: Draw Card V2 Component
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
- **AND** the ring SHALL use color gradients (red → yellow → green)

### Requirement: Match Card V2 Component
Match cards SHALL present match information with clear visual hierarchy.

#### Scenario: Match card two-column layout
- **WHEN** user views a match card on desktop
- **THEN** the left column SHALL display odds and market data
- **AND** the right column SHALL display AI prediction and actions
- **AND** a tabbed panel SHALL provide access to detailed data

#### Scenario: Match card odds display
- **WHEN** odds are available for a match
- **THEN** the odds ticker SHALL show current odds for 1, X, 2
- **AND** odds movement indicators (↑↓−) SHALL show direction
- **AND** color coding SHALL indicate favorable vs unfavorable movement

#### Scenario: Match card prediction panel
- **WHEN** an AI prediction exists for a match
- **THEN** the prediction panel SHALL prominently display:
  - Predicted outcome (1, X, or 2)
  - Confidence level with visual meter
  - Probability distribution (1: X%, X: Y%, 2: Z%)
  - Value opportunity badge if EV > 3%
  - Spik candidate indicator if applicable

### Requirement: Value Badge Component
The system SHALL provide visual badges for Expected Value opportunities.

#### Scenario: Value badge display thresholds
- **WHEN** expected value is calculated for a bet
- **THEN** a badge SHALL appear based on EV threshold:
  - 3% ≤ EV < 5%: Green "Value" badge
  - 5% ≤ EV < 10%: Emerald "Strong Value" badge
  - EV ≥ 10%: Amber "Exceptional Value" badge
- **AND** the badge SHALL include the EV percentage

### Requirement: Confidence Meter Component
The system SHALL visualize prediction confidence as a gauge.

#### Scenario: Confidence meter visualization
- **WHEN** a prediction has a confidence level
- **THEN** the confidence meter SHALL render a visual gauge
- **AND** low confidence SHALL render in red (0-40%)
- **AND** medium confidence SHALL render in yellow (40-70%)
- **AND** high confidence SHALL render in green (70-100%)

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

### Requirement: Command Palette
Power users SHALL be able to navigate using keyboard shortcuts.

#### Scenario: Command palette activation
- **WHEN** user presses Cmd+K (Mac) or Ctrl+K (Windows/Linux)
- **THEN** a command palette overlay SHALL appear
- **AND** the search input SHALL receive focus

#### Scenario: Command palette navigation
- **WHEN** command palette is open
- **THEN** user MAY type to filter available commands
- **AND** user MAY use arrow keys to navigate results
- **AND** user MAY press Enter to execute selected command
- **AND** user MAY press Escape to close palette

#### Scenario: Command palette commands
- **WHEN** user searches in command palette
- **THEN** available commands SHALL include:
  - "Go to Draw #[number]"
  - "Switch to [Stryktipset|Europatipset|Topptipset]"
  - "Generate predictions for current draw"
  - "Toggle dark mode"
  - "Open settings"

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

### Requirement: Responsive Design
All v2 components SHALL be fully responsive.

#### Scenario: Mobile responsiveness
- **WHEN** viewport is mobile-sized
- **THEN** match cards SHALL stack vertically
- **AND** odds and prediction SHALL stack rather than side-by-side
- **AND** touch targets SHALL be at least 44x44 pixels
- **AND** tab panels SHALL be full-width

### Requirement: Accessibility Compliance
All v2 components SHALL meet WCAG 2 AA standards.

#### Scenario: Keyboard navigation
- **WHEN** user navigates using keyboard only
- **THEN** all interactive elements SHALL be focusable
- **AND** focus order SHALL be logical
- **AND** focus indicators SHALL be visible

#### Scenario: Screen reader support
- **WHEN** user uses a screen reader
- **THEN** all components SHALL have appropriate ARIA labels
- **AND** live regions SHALL announce dynamic updates
- **AND** images/icons SHALL have alt text or be marked decorative

#### Scenario: Color contrast
- **WHEN** colors are used for meaning
- **THEN** contrast ratio SHALL meet 4.5:1 for normal text
- **AND** contrast ratio SHALL meet 3:1 for large text
- **AND** non-color indicators SHALL supplement color coding

### Requirement: Dark Mode Support
V2 components SHALL support both light and dark color modes.

#### Scenario: Dark mode rendering
- **WHEN** system or user preference is dark mode
- **THEN** all v2 components SHALL use dark color tokens
- **AND** contrast requirements SHALL be maintained
- **AND** no component SHALL use hard-coded light colors

### Requirement: UI Version Preference System
The system SHALL allow users to opt-in/opt-out of the V2 UI via localStorage.

#### Scenario: User opts into V2 UI
- **WHEN** user clicks "Try New UI" on the promo banner
- **THEN** the preference SHALL be stored in localStorage as `st-predictor-ui-preference=v2`
- **AND** the user SHALL be redirected to `/v2`
- **AND** subsequent visits SHALL automatically redirect to V2 routes

#### Scenario: User opts out of V2 UI
- **WHEN** user clicks "Switch to Classic UI" in the V2 sidebar
- **THEN** the preference SHALL be stored in localStorage as `st-predictor-ui-preference=v1`
- **AND** the user SHALL be redirected to the V1 dashboard
- **AND** subsequent visits SHALL NOT redirect to V2 routes

#### Scenario: No preference set (default)
- **WHEN** user has not set a UI preference
- **THEN** the user SHALL remain on whichever UI they navigated to
- **AND** a promo banner SHALL be displayed on V1 pages to encourage trying V2

### Requirement: V2 Promo Banner
The system SHALL display a promotional banner encouraging users to try the V2 UI.

#### Scenario: Promo banner display
- **WHEN** user is on a V1 page
- **AND** user has not set a UI preference
- **AND** user has not dismissed the banner
- **THEN** a promo banner SHALL be displayed at the top of the page

#### Scenario: Promo banner dismissal
- **WHEN** user clicks "Maybe Later" or the close button on the promo banner
- **THEN** the banner SHALL be hidden
- **AND** the dismissal SHALL be stored in localStorage
- **AND** the banner SHALL NOT reappear for the session

### Requirement: V2 Route Middleware
The system SHALL automatically redirect users to V2 routes based on their preference.

#### Scenario: Automatic V2 redirect
- **WHEN** user has preference set to `v2`
- **AND** user navigates to a V1 route (e.g., `/analytics`)
- **THEN** the user SHALL be automatically redirected to the corresponding V2 route (e.g., `/v2/analytics`)

#### Scenario: V2 feature flag disabled
- **WHEN** `ENABLE_UI_V2=false` in environment configuration
- **AND** user navigates to a V2 route
- **THEN** the user SHALL be redirected to the corresponding V1 route

### Requirement: V2 Page Coverage
All primary pages SHALL have V2 versions using the V2 layout.

#### Scenario: V2 page routes
- **WHEN** V2 UI is enabled and user has opted in
- **THEN** the following V2 routes SHALL be available:
  - `/v2` - Dashboard
  - `/v2/analytics` - Prediction Analytics
  - `/v2/ai-dashboard` - AI Metrics Dashboard
  - `/v2/performance` - System Performance
  - `/v2/admin` - Admin Control Panel
  - `/v2/draw/[id]` - Draw Detail
  - `/v2/draw/[id]/optimize` - Coupon Optimization

### Requirement: Sidebar Toggle Mechanism
The sidebar collapse/expand SHALL be controlled via the header hamburger menu only.

#### Scenario: Sidebar toggle on desktop
- **WHEN** user clicks the hamburger menu icon in the header
- **THEN** the sidebar SHALL toggle between expanded and collapsed states
- **AND** NO separate collapse button SHALL be displayed on the sidebar itself

### Requirement: Display System Guarantee Information

The UI SHALL display system guarantee levels and 13 rätt chances when selecting R/U systems.

#### Scenario: Display guarantee in system selector

- **GIVEN** the user is selecting a betting system
- **WHEN** the system selector is rendered
- **THEN** each system SHALL display its guarantee level (e.g., "Guarantees 12 rätt")
- **AND** SHALL display the 13 rätt chance percentage

#### Scenario: Explain guarantee conditions

- **GIVEN** a system with guarantee level displayed
- **WHEN** the user hovers over or taps the guarantee badge
- **THEN** the UI SHALL show a tooltip explaining "Guarantee only applies when all selections contain the correct outcome"

---

### Requirement: Display Score Distribution

The UI SHALL display historical score distribution for betting systems to help users evaluate system performance.

#### Scenario: Show score distribution chart

- **GIVEN** a system has performance history with score_distribution data
- **WHEN** the system detail view is rendered
- **THEN** the UI SHALL display a bar chart showing counts for 10, 11, 12, and 13 rätt

#### Scenario: Show hit rate percentages

- **GIVEN** a system has performance history
- **WHEN** the system statistics are displayed
- **THEN** the UI SHALL show percentages for:
  - 10+ rätt hit rate
  - 11+ rätt hit rate
  - 12+ rätt hit rate
  - 13 rätt win rate

#### Scenario: Handle missing distribution data

- **GIVEN** a system has no performance history yet
- **WHEN** the system detail view is rendered
- **THEN** the UI SHALL display "No historical data yet" instead of empty charts

---

### Requirement: Display Winning Row for Completed Draws

The UI SHALL display the correct (winning) row for completed draws to enable result analysis.

#### Scenario: Show winning combination

- **GIVEN** a draw has status "Completed" with all match outcomes recorded
- **WHEN** the completed draw results view is rendered
- **THEN** the UI SHALL display the correct row as a sequence of 13 outcomes (e.g., "1X21X112X21X2")

#### Scenario: Compare generated coupon to winning row

- **GIVEN** a completed draw has generated coupon rows stored
- **WHEN** viewing the draw results
- **THEN** the UI SHALL display each generated row alongside the correct row
- **AND** SHALL visually highlight matching outcomes (green) and mismatches (red)

#### Scenario: Show best score achieved

- **GIVEN** a completed draw has been analyzed
- **WHEN** the draw results are displayed
- **THEN** the UI SHALL prominently show the best score achieved (e.g., "Best: 11 rätt")
- **AND** SHALL show how many rows achieved each score level

---

### Requirement: Recent Results in Performance Dashboard

The UI SHALL display recent completed draw results in the performance dashboard for quick review.

#### Scenario: Show recent completed draws

- **GIVEN** at least one draw has been completed and analyzed
- **WHEN** the performance dashboard is rendered
- **THEN** the UI SHALL display a "Recent Results" section with the last 5 completed draws

#### Scenario: Recent result summary per draw

- **GIVEN** a completed draw appears in recent results
- **WHEN** the entry is rendered
- **THEN** it SHALL display:
  - Draw number and date
  - System used
  - Best score achieved
  - Payout amount (or "No win" if 0)
  - Link to view full details

#### Scenario: Filter results by system type

- **GIVEN** the user wants to compare R vs U system performance
- **WHEN** filtering options are available
- **THEN** the UI SHALL allow filtering recent results by system type (R, U, or All)

### Requirement: Historic Draw Results Page
The system SHALL provide a dedicated page for viewing completed draw results and performance analysis at `/draw/[id]/results`.

#### Scenario: Results page header display
- **WHEN** user navigates to `/draw/{drawNumber}/results?gameType={type}`
- **THEN** the page SHALL display the draw number and game type
- **AND** the page SHALL display a "Completed" status badge
- **AND** the page SHALL display the draw date
- **AND** the page SHALL display the correct row (e.g., "1X21X2X1X21X2")

#### Scenario: Match results table display
- **WHEN** the results page loads successfully
- **THEN** a table SHALL display all matches with:
  - Match number
  - Home team name
  - Away team name
  - Final score (home - away)
  - Outcome badge (1, X, or 2)
- **AND** matches SHALL be ordered by match number

#### Scenario: Results page loading state
- **WHEN** the results page is fetching data
- **THEN** a loading spinner SHALL be displayed
- **AND** the text "Loading results..." SHALL be shown

#### Scenario: Results page error state
- **WHEN** the draw data fails to load or draw is not found
- **THEN** an error alert SHALL be displayed
- **AND** the alert SHALL indicate the draw was not found or failed to load

### Requirement: System Performance Display
The results page SHALL display performance metrics for generated betting systems.

#### Scenario: Performance summary cards
- **WHEN** system performance data is available
- **THEN** summary cards SHALL display:
  - Best score achieved across all systems
  - Total rows played
  - Total cost invested
  - Total payout received
  - Overall ROI percentage

#### Scenario: Individual system performance
- **WHEN** multiple systems were generated for the draw
- **THEN** each system SHALL be displayed in a card showing:
  - System ID (e.g., "R-4-0-9-12")
  - System type (R-system, U-system, or T-system)
  - Number of rows
  - Best score achieved
  - Winning rows count
  - Payout amount
  - ROI percentage
- **AND** systems SHALL be sorted by best score descending

#### Scenario: Score distribution display
- **WHEN** a system has score distribution data
- **THEN** the distribution SHALL be visualized showing count per score tier
- **AND** the tiers SHALL be appropriate for game type (10-13 for Stryktipset/Europatipset, 5-8 for Topptipset)

#### Scenario: No performance data
- **WHEN** no system performance records exist for the draw
- **THEN** a message SHALL indicate "No betting systems were generated for this draw"

### Requirement: Payout Information Display
The results page SHALL display prize payout information when available.

#### Scenario: Payout tier breakdown
- **WHEN** payout information is available in draw data
- **THEN** the page SHALL display prize amounts for each tier:
  - 13 correct (Stryktipset/Europatipset) or 8 correct (Topptipset)
  - 12 correct or 7 correct
  - 11 correct or 6 correct
  - 10 correct or 5 correct
- **AND** amounts SHALL be formatted as Swedish kronor (SEK)

#### Scenario: Payout information unavailable
- **WHEN** payout information is not available
- **THEN** the payout section SHALL be hidden or show "Payout data unavailable"

### Requirement: Admin Draw Navigation Routing
The admin page SHALL route to appropriate pages based on draw status.

#### Scenario: Navigate to current draw
- **WHEN** admin clicks on a draw with `is_current: true`
- **THEN** the browser SHALL navigate to `/draw/{drawNumber}?gameType={type}`
- **AND** the user SHALL land on the active draw work page

#### Scenario: Navigate to archived draw
- **WHEN** admin clicks on a draw with `is_current: false`
- **THEN** the browser SHALL navigate to `/draw/{drawNumber}/results?gameType={type}`
- **AND** the user SHALL land on the results analysis page

#### Scenario: Draw item displays required data
- **WHEN** admin views draws in the admin page
- **THEN** each draw item SHALL have `id`, `draw_number`, `game_type`, and `is_current` available
- **AND** the data SHALL be sufficient for determining navigation destination

### Requirement: Draw Detail Page Error Handling
The draw detail page SHALL handle missing or failed data gracefully.

#### Scenario: Draw not found
- **WHEN** the requested draw does not exist
- **THEN** an error alert SHALL be displayed with title "Draw Not Found"
- **AND** a message SHALL suggest checking the draw number

#### Scenario: Draw fetch failure
- **WHEN** the draw data fetch fails due to network or server error
- **THEN** an error alert SHALL be displayed
- **AND** a retry button SHALL be available

