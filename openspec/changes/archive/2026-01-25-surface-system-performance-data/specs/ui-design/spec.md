## ADDED Requirements

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
