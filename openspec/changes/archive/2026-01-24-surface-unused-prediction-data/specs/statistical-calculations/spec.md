## MODIFIED Requirements

### Requirement: Contextual Match Factors

The system SHALL calculate contextual factors that affect match outcomes but are not captured by pure statistical models.

#### Scenario: Calculate rest days

- **GIVEN** the current match date and each team's previous match date
- **WHEN** match calculations are generated
- **THEN** the system SHALL store `home_rest_days` and `away_rest_days` as integers

#### Scenario: Cap rest days at reasonable maximum

- **GIVEN** a team's last recorded match is more than 90 days before the current match
- **WHEN** rest days are calculated
- **THEN** the system SHALL return `null` instead of the actual day count, indicating insufficient recent data

#### Scenario: Flag fatigue risk

- **GIVEN** a team has rest_days < 3 and rest_days is not null
- **WHEN** preparing prediction context
- **THEN** the system SHALL include a "Fatigue Risk" warning in the AI prompt

#### Scenario: Calculate importance score

- **GIVEN** team league positions and remaining matches
- **WHEN** match calculations are generated
- **THEN** the system SHALL compute `importance_score` (0-1) based on proximity to title race, relegation zone, or European qualification positions
