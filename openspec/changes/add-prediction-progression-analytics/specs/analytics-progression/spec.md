## ADDED Requirements

### Requirement: Prediction Progression Timeline

The system SHALL display a time-series visualization of prediction accuracy progression on the analytics page.

#### Scenario: Weekly accuracy trend display
- **GIVEN** the user navigates to the analytics page
- **AND** there are prediction performance records spanning multiple weeks
- **WHEN** the progression section loads
- **THEN** the system SHALL display a line chart showing weekly accuracy percentages
- **AND** each data point SHALL represent the accuracy for that calendar week
- **AND** the chart SHALL show at least the last 12 weeks of data when available

#### Scenario: Brier score trend display
- **GIVEN** the user views the progression section
- **AND** there are match calculations with Brier scores
- **WHEN** the Brier score chart renders
- **THEN** the system SHALL display weekly Brier scores on a separate line or axis
- **AND** lower values SHALL be visually indicated as better (e.g., inverted scale or color coding)

#### Scenario: No historical data
- **GIVEN** the user navigates to the analytics page
- **AND** there are fewer than 2 weeks of prediction data
- **WHEN** the progression section loads
- **THEN** the system SHALL display a message explaining insufficient data for trends
- **AND** the system SHALL NOT display an empty or broken chart

### Requirement: Rolling Window Comparison

The system SHALL display rolling average metrics to smooth out weekly variance and highlight trends.

#### Scenario: 30-day rolling accuracy
- **GIVEN** the progression chart is displayed
- **AND** there are at least 30 days of prediction history
- **WHEN** the rolling average is computed
- **THEN** the system SHALL overlay a 30-day rolling accuracy line on the chart
- **AND** the rolling line SHALL be visually distinct from the weekly data points (e.g., dashed line)

#### Scenario: Period comparison statistics
- **GIVEN** the user views the progression section
- **WHEN** the period comparison loads
- **THEN** the system SHALL display the current period accuracy (last 30 days)
- **AND** the system SHALL display the previous period accuracy (31-60 days ago)
- **AND** the system SHALL indicate the direction of change (improving/declining/stable)

### Requirement: Game Type Filter

The system SHALL allow filtering progression metrics by betting game type.

#### Scenario: Filter by game type
- **GIVEN** the user is viewing the progression section
- **AND** there are predictions for multiple game types (Stryktipset, Europatipset, Topptipset)
- **WHEN** the user selects a specific game type from the filter
- **THEN** the progression chart SHALL update to show only predictions for that game type
- **AND** the period comparison statistics SHALL update accordingly

#### Scenario: All games view
- **GIVEN** the user is viewing the progression section
- **WHEN** the filter is set to "All" (default)
- **THEN** the progression data SHALL include predictions from all game types combined
