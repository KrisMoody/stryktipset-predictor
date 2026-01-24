## ADDED Requirements

### Requirement: Display Expert and Public Betting Data

The UI SHALL display Svenska Folket (public betting distribution) and Tio Tidningars Tips (expert consensus) when available.

#### Scenario: Display Svenska Folket percentages

- **GIVEN** a match has Svenska Folket data in match_odds
- **WHEN** the match card or odds section is rendered
- **THEN** the UI SHALL display the public betting distribution as a stacked bar chart with percentage numbers for 1, X, and 2

#### Scenario: Display Tio Tidningars Tips

- **GIVEN** a match has Tio Tidningars Tips data in match_odds
- **WHEN** the match card or odds section is rendered
- **THEN** the UI SHALL display the expert consensus as "X/10" for each outcome

#### Scenario: Handle missing betting data gracefully

- **GIVEN** a match is missing Svenska Folket or Tio Tidningars Tips data
- **WHEN** the match card is rendered
- **THEN** the UI SHALL hide the respective section rather than showing empty values

---

### Requirement: Display Statistical Model Details

The UI SHALL display key statistical model outputs to help users understand prediction context.

#### Scenario: Display Expected Goals

- **GIVEN** a match has match_calculations with expected goals
- **WHEN** the model analysis section is rendered
- **THEN** the UI SHALL display `expected_home_goals` and `expected_away_goals` with one decimal precision

#### Scenario: Display Bookmaker Margin

- **GIVEN** a match has match_calculations with bookmaker_margin > 0
- **WHEN** the model analysis section is rendered
- **THEN** the UI SHALL display the margin as a percentage (e.g., "4.2% margin")

#### Scenario: Display Team Elo Ratings

- **GIVEN** teams have Elo ratings stored in team_ratings
- **WHEN** the match details or model analysis section is rendered
- **THEN** the UI SHALL display each team's Elo rating with confidence indicator (low/medium/high)

#### Scenario: Display Rest Days with Fatigue Warning

- **GIVEN** a match has match_calculations with rest_days
- **WHEN** the contextual factors section is rendered
- **THEN** the UI SHALL display rest days per team, with a warning indicator when rest_days < 3

#### Scenario: Hide rest days when unknown

- **GIVEN** a match has null rest_days (due to exceeding 90-day cap)
- **WHEN** the contextual factors section is rendered
- **THEN** the UI SHALL hide the rest days display for that team

---

### Requirement: Display Regression and Form Trend Indicators

The UI SHALL display xG-based regression warnings and form trends to help users identify teams likely to regress to their expected performance.

#### Scenario: Display regression flag warning

- **GIVEN** a team has a regression_flag of "overperforming" or "underperforming"
- **WHEN** the model analysis section is rendered
- **THEN** the UI SHALL display a warning indicator with the regression direction (e.g., "Overperforming xG - expect regression")

#### Scenario: Display xG trend

- **GIVEN** a match has match_calculations with xg_trend values
- **WHEN** the model analysis section is rendered
- **THEN** the UI SHALL display the xG trend with a positive/negative indicator (e.g., "+0.45 xGD/game" or "-0.32 xGD/game")

#### Scenario: Handle missing regression data

- **GIVEN** a team has null regression_flag or xg_trend
- **WHEN** the model analysis section is rendered
- **THEN** the UI SHALL hide that specific indicator rather than showing empty values
