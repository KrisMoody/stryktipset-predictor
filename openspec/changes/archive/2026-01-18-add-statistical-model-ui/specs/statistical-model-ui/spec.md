## ADDED Requirements

### Requirement: Match Model Analysis Display

The system SHALL display statistical model calculations for each match in an expandable "Model Analysis" section, showing Dixon-Coles probabilities, expected values, and form metrics.

#### Scenario: Display probability comparison

- **GIVEN** a match has `match_calculations` data
- **WHEN** user expands the Model Analysis section
- **THEN** the system SHALL display model probabilities (1/X/2) alongside market probabilities with the difference highlighted

#### Scenario: Display expected goals

- **GIVEN** model calculations include `expected_home_goals` and `expected_away_goals`
- **WHEN** user views the Model Analysis section
- **THEN** the system SHALL display λ_home and λ_away values labeled as "Expected Goals"

#### Scenario: Display expected value calculations

- **GIVEN** model calculations include `ev_home`, `ev_draw`, `ev_away`
- **WHEN** user views the Model Analysis section
- **THEN** the system SHALL display EV as percentage for each outcome, highlighting positive EV outcomes with a visual indicator

#### Scenario: Display form metrics

- **GIVEN** model calculations include `home_form_ema` and `away_form_ema`
- **WHEN** user views the Model Analysis section
- **THEN** the system SHALL display form scores as visual progress bars (0-1 scale) with numeric values

#### Scenario: Display regression warnings

- **GIVEN** a team has `home_regression_flag` or `away_regression_flag` set to 'overperforming' or 'underperforming'
- **WHEN** user views the Model Analysis section
- **THEN** the system SHALL display a warning badge indicating the regression direction

#### Scenario: Handle missing model data gracefully

- **GIVEN** a match has no `match_calculations` data
- **WHEN** user tries to expand the Model Analysis section
- **THEN** the system SHALL display "Model data unavailable" message without breaking the UI

---

### Requirement: Value Opportunity Indicator

The system SHALL display a prominent "VALUE" badge on matches where the statistical model identifies a positive expected value opportunity above the configured threshold.

#### Scenario: Display value badge when EV exceeds threshold

- **GIVEN** a match has `best_value_outcome` set and the corresponding EV is > 3%
- **WHEN** the match card is rendered
- **THEN** the system SHALL display a "VALUE" badge near the AI Prediction section

#### Scenario: Color-code by EV magnitude

- **GIVEN** a value opportunity exists
- **WHEN** the VALUE badge is displayed
- **THEN** the system SHALL color the badge based on EV magnitude (green for 3-5%, gold for 5-10%, red-gold for >10%)

#### Scenario: Hide value badge when no opportunity

- **GIVEN** a match has no positive EV outcome above threshold
- **WHEN** the match card is rendered
- **THEN** the system SHALL NOT display the VALUE badge

---

### Requirement: Team Rating Tooltip

The system SHALL display team Elo ratings, attack strength, and defense strength in a tooltip when users hover over team names.

#### Scenario: Show ratings on hover

- **GIVEN** a team has ratings stored in `team_ratings`
- **WHEN** user hovers over the team name in a match card
- **THEN** the system SHALL display a tooltip showing Elo rating, attack strength, defense strength, and confidence level

#### Scenario: Show matches played for context

- **GIVEN** team ratings include `matches_played` count
- **WHEN** user views the team rating tooltip
- **THEN** the system SHALL display "Based on N matches" text

#### Scenario: Handle missing ratings gracefully

- **GIVEN** a team has no ratings in the database
- **WHEN** user hovers over the team name
- **THEN** the system SHALL display "No rating data available" in the tooltip

---

### Requirement: Model Performance Analytics

The analytics page SHALL include a section showing statistical model accuracy and calibration metrics.

#### Scenario: Display model accuracy

- **GIVEN** historical predictions have been evaluated against actual outcomes
- **WHEN** admin views the analytics page
- **THEN** the system SHALL display overall model accuracy percentage (correct outcome / total predictions)

#### Scenario: Display EV bet tracking

- **GIVEN** matches with positive EV opportunities have completed
- **WHEN** admin views the analytics page
- **THEN** the system SHALL display theoretical profit/loss from following all EV>3% opportunities

---

### Requirement: Admin Team Ratings Management

The admin page SHALL include a section for viewing and managing team ratings with filtering capabilities.

#### Scenario: List all team ratings

- **GIVEN** admin navigates to admin page
- **WHEN** viewing the Team Ratings section
- **THEN** the system SHALL display all teams with their Elo, attack, defense ratings and confidence levels

#### Scenario: Filter by confidence level

- **GIVEN** teams have varying confidence levels (low/medium/high)
- **WHEN** admin selects a confidence filter
- **THEN** the system SHALL display only teams matching the selected confidence level

#### Scenario: Show low-confidence teams for review

- **GIVEN** some teams have 'low' confidence ratings
- **WHEN** admin views the Team Ratings section
- **THEN** the system SHALL highlight low-confidence teams as needing more match data

---

### Requirement: Match Calculations API

The system SHALL provide API endpoints for retrieving statistical model calculations and team ratings.

#### Scenario: Fetch match calculations

- **GIVEN** a match ID
- **WHEN** client calls `GET /api/matches/:id/calculations`
- **THEN** the system SHALL return the `match_calculations` record including all probabilities, EVs, form metrics, and contextual factors

#### Scenario: Fetch team ratings

- **GIVEN** a team ID
- **WHEN** client calls `GET /api/teams/:id/ratings`
- **THEN** the system SHALL return the team's Elo, attack, defense ratings with confidence and matches played

#### Scenario: Handle non-existent calculations

- **GIVEN** a match ID with no calculations
- **WHEN** client calls the calculations endpoint
- **THEN** the system SHALL return 404 with message "Calculations not available for this match"
