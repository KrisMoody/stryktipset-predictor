# statistical-calculations Specification

## Purpose
TBD - created by archiving change add-statistical-calculations. Update Purpose after archive.
## Requirements
### Requirement: Team Rating System

The system SHALL maintain Elo-based ratings for each team, with separate attack and defense strength components, updated automatically after each completed match.

#### Scenario: Initialize rating for new team

- **GIVEN** a team appears in a draw for the first time
- **WHEN** the match data is synced
- **THEN** the system SHALL create initial ratings with `elo=1500`, `attack=1.0`, `defense=1.0`, and `confidence='low'`

#### Scenario: Update ratings after match completion

- **GIVEN** a match has completed with final score and xG statistics
- **WHEN** the results are processed
- **THEN** the system SHALL update both teams' Elo, attack, and defense ratings based on the K-factor formula and actual vs expected performance

#### Scenario: Mark rating confidence level

- **GIVEN** a team has played N matches in the rating system
- **WHEN** ratings are retrieved
- **THEN** confidence SHALL be 'low' for N < 5, 'medium' for 5 <= N < 15, and 'high' for N >= 15

---

### Requirement: Dixon-Coles Probability Model

The system SHALL calculate match outcome probabilities using the Dixon-Coles bivariate Poisson distribution model, incorporating team attack/defense strengths and home advantage.

#### Scenario: Calculate expected goals

- **GIVEN** two teams with known attack and defense ratings
- **WHEN** match calculations are generated
- **THEN** the system SHALL calculate `expected_home_goals = home_attack × away_defense × home_advantage` and `expected_away_goals = away_attack × home_defense`

#### Scenario: Generate outcome probabilities

- **GIVEN** expected goals for both teams
- **WHEN** calculating probabilities
- **THEN** the system SHALL compute P(home_win), P(draw), P(away_win) by summing Poisson-distributed scoreline probabilities up to 10 goals each, with Dixon-Coles low-score correction (rho parameter)

#### Scenario: Apply time decay weighting

- **GIVEN** historical match data used for rating calculation
- **WHEN** updating team parameters
- **THEN** the system SHALL weight recent matches higher using exponential decay with half-life of 30 matches

---

### Requirement: Fair Odds Calculation

The system SHALL calculate fair (margin-free) probabilities from bookmaker odds and identify the overround percentage.

#### Scenario: Remove bookmaker margin

- **GIVEN** odds of 2.10 / 3.40 / 3.50 (implied sum = 103.2%)
- **WHEN** fair probabilities are calculated
- **THEN** the system SHALL divide each implied probability by the sum to produce fair probabilities that total 100%

#### Scenario: Calculate bookmaker margin

- **GIVEN** current match odds from Svenska Spel
- **WHEN** match calculations are generated
- **THEN** the system SHALL store `bookmaker_margin = (sum_of_implied_probabilities - 1) × 100` as a percentage

---

### Requirement: Expected Value Calculation

The system SHALL calculate the Expected Value (EV) for each outcome by comparing model probabilities to market odds.

#### Scenario: Calculate EV for each outcome

- **GIVEN** model probability 0.45 for home win and odds 2.30
- **WHEN** EV is calculated
- **THEN** `ev_home = (0.45 × 2.30) - 1 = 0.035` (positive EV indicates value)

#### Scenario: Identify best value outcome

- **GIVEN** EV calculations for all three outcomes
- **WHEN** match calculations are stored
- **THEN** `best_value_outcome` SHALL be set to the outcome with highest positive EV, or null if all EVs are negative

#### Scenario: Highlight significant value opportunities

- **GIVEN** an outcome has EV > 0.05 (5% edge)
- **WHEN** preparing prediction context
- **THEN** the system SHALL flag this as a "Value Opportunity" in the AI prompt

---

### Requirement: EMA Form Score

The system SHALL calculate Exponential Moving Average (EMA) form scores for each team, providing a continuous 0-1 metric that weights recent matches more heavily.

#### Scenario: Calculate points-based EMA

- **GIVEN** a team's last 10 match results
- **WHEN** form score is calculated
- **THEN** the system SHALL apply EMA with alpha=0.3, converting W/D/L to 1.0/0.33/0.0 scores

#### Scenario: Calculate xG-adjusted form

- **GIVEN** a team's xG and xGA for recent matches
- **WHEN** form metrics are calculated
- **THEN** the system SHALL also compute `xg_trend = average(xG - xGA)` over last 5 matches to detect over/underperformance

#### Scenario: Identify regression candidates

- **GIVEN** a team's actual points significantly differ from xG-implied points
- **WHEN** match calculations include form metrics
- **THEN** the system SHALL flag teams where `|actual_form - xg_form| > 0.2` as regression candidates

---

### Requirement: Contextual Match Factors

The system SHALL calculate contextual factors that affect match outcomes but are not captured by pure statistical models.

#### Scenario: Calculate rest days

- **GIVEN** the current match date and each team's previous match date
- **WHEN** match calculations are generated
- **THEN** the system SHALL store `home_rest_days` and `away_rest_days` as integers

#### Scenario: Flag fatigue risk

- **GIVEN** a team has rest_days < 3
- **WHEN** preparing prediction context
- **THEN** the system SHALL include a "Fatigue Risk" warning in the AI prompt

#### Scenario: Calculate importance score

- **GIVEN** team league positions and remaining matches
- **WHEN** match calculations are generated
- **THEN** the system SHALL compute `importance_score` (0-1) based on proximity to title race, relegation zone, or European qualification positions

---

### Requirement: Pre-Calculation Pipeline

The system SHALL automatically calculate all statistical metrics when match data is synced, storing results for fast retrieval during prediction generation.

#### Scenario: Trigger calculations on draw sync

- **GIVEN** a draw's match data has been synced with odds and xStats
- **WHEN** the sync completes
- **THEN** the system SHALL trigger `calculateMatchStatistics()` for each match

#### Scenario: Skip calculation for completed matches

- **GIVEN** a match already has calculations stored
- **WHEN** a re-sync occurs
- **THEN** the system SHALL skip recalculation unless team ratings have been updated since

#### Scenario: Handle missing data gracefully

- **GIVEN** a match is missing xStats or historical data for team ratings
- **WHEN** calculations are attempted
- **THEN** the system SHALL use league-average defaults and mark `data_quality='partial'`

---

### Requirement: Prediction Service Integration

The prediction service SHALL include calculated statistics in the AI context, presenting model probabilities as a baseline for Claude to adjust based on additional factors.

#### Scenario: Include model probabilities in prompt

- **GIVEN** match calculations exist for a match
- **WHEN** preparing the AI prediction context
- **THEN** the system SHALL include a "STATISTICAL MODEL BASELINE" section showing model probabilities, fair odds, and any value opportunities

#### Scenario: Highlight disagreements

- **GIVEN** model probability differs from odds-implied probability by > 10%
- **WHEN** preparing prediction context
- **THEN** the system SHALL note "Model disagrees with market" and specify which direction

#### Scenario: Present regression signals

- **GIVEN** either team is flagged as a regression candidate
- **WHEN** preparing prediction context
- **THEN** the system SHALL include "REGRESSION WARNING: {team} is over/underperforming xG by {amount}"

---

### Requirement: Database Schema

The system SHALL store team ratings and match calculations in dedicated database tables with proper indexing and versioning.

#### Scenario: Store team ratings with history

- **GIVEN** a team's rating is updated
- **WHEN** the update is persisted
- **THEN** the system SHALL store the new rating with `model_version`, `matches_played`, and `updated_at` timestamp

#### Scenario: Store match calculations

- **GIVEN** calculations are completed for a match
- **WHEN** persisting to database
- **THEN** the system SHALL upsert to `match_calculations` with all computed fields and `model_version`

#### Scenario: Index for efficient retrieval

- **GIVEN** predictions need match calculations
- **WHEN** querying the database
- **THEN** `match_calculations` SHALL have an index on `match_id` for O(1) lookup

