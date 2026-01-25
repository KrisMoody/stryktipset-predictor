# Spec Delta: ui-design

## ADDED Requirements

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
