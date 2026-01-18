## 1. Database Schema

- [x] 1.1 Create `team_ratings` table in Prisma schema
  - Fields: team_id, rating_type (elo/attack/defense), rating_value, model_version, matches_played, confidence, last_match_date, created_at, updated_at
  - Unique constraint on (team_id, rating_type, model_version)
  - Indexes on team_id, rating_type, model_version

- [x] 1.2 Create `match_calculations` table in Prisma schema
  - Fields: model probabilities, fair probabilities, EV calculations, form metrics, contextual factors
  - Unique constraint on match_id
  - Index on match_id for fast lookup

- [x] 1.3 Run Prisma migration and generate client

## 2. Core Calculation Engine

- [x] 2.1 Create `server/services/statistical-calculations/` directory structure
  - `index.ts` - Main service export
  - `elo-rating.ts` - Elo calculation functions
  - `dixon-coles.ts` - Poisson model implementation
  - `form-calculator.ts` - EMA and trend calculations
  - `value-calculator.ts` - EV and fair odds
  - `types.ts` - TypeScript interfaces

- [x] 2.2 Implement Elo rating system (`elo-rating.ts`)
  - `initializeRating(teamId)` - Create initial 1500 rating
  - `calculateExpected(ratingA, ratingB)` - Expected score formula
  - `updateRatings(match)` - Update both teams after match
  - `getTeamRatings(teamId)` - Retrieve current ratings
  - K-factor formula with margin and home adjustment

- [x] 2.3 Implement Dixon-Coles model (`dixon-coles.ts`)
  - `poissonProbability(goals, lambda)` - Single goal probability
  - `dixonColesCorrection(homeGoals, awayGoals, rho)` - Low-score adjustment
  - `calculateExpectedGoals(homeRatings, awayRatings)` - Lambda values
  - `calculateOutcomeProbabilities(lambdaHome, lambdaAway)` - Sum over scorelines
  - Configurable rho parameter (default -0.1)

- [x] 2.4 Implement form calculator (`form-calculator.ts`)
  - `calculateEMAForm(results, alpha)` - Points-based EMA
  - `calculateXGTrend(xgData)` - xG differential trend
  - `identifyRegressionCandidate(actualForm, xgForm)` - Flag over/underperformers
  - Default alpha = 0.3, lookback = 10 matches

- [x] 2.5 Implement value calculator (`value-calculator.ts`)
  - `removeBetMargin(odds)` - Fair probability calculation
  - `calculateEV(modelProb, odds)` - Expected value per outcome
  - `identifyValueBet(evs, threshold)` - Flag best value outcome
  - Default threshold = 0.03 (3% edge)

## 3. Match Calculation Service

- [x] 3.1 Create main calculation service (`server/services/statistical-calculations/index.ts`)
  - `calculateMatchStatistics(matchId)` - Orchestrate all calculations
  - `getTeamRatingsForMatch(homeTeamId, awayTeamId)` - Fetch ratings
  - `getRecentForm(teamId, count)` - Fetch recent match data
  - `saveCalculations(matchId, calculations)` - Persist to DB

- [x] 3.2 Implement contextual factors calculation
  - `calculateRestDays(teamId, matchDate)` - Days since last match
  - `calculateImportanceScore(teamId, leagueId)` - Position-based score
  - Query API-Football or scraped data for previous matches

- [x] 3.3 Add data quality handling
  - Track which data sources were available
  - Use league averages for missing team ratings
  - Mark calculations with `data_quality: 'full' | 'partial' | 'minimal'`

## 4. Integration with Draw Sync

- [x] 4.1 Modify `draw-sync.ts` to trigger calculations
  - Add calculation step after scraping completes
  - Process all matches in draw via Promise.all
  - Log calculation results and any errors

- [x] 4.2 Add calculation status tracking
  - Track which matches have calculations
  - Skip recalculation if already computed (unless ratings updated)
  - Add `calculations_status` to draw monitoring

- [x] 4.3 Handle initial backfill
  - Create script to calculate for existing matches
  - Prioritize current/upcoming draws
  - Run as background job

## 5. Prediction Service Integration

- [x] 5.1 Modify `prediction-service.ts` context preparation
  - Add `STATISTICAL MODEL BASELINE` section to prompt
  - Include model probabilities, fair odds, EV calculations
  - Format as structured data for Claude

- [x] 5.2 Add value opportunity highlighting
  - Detect EV > 5% outcomes
  - Add `VALUE OPPORTUNITY` flag to prompt
  - Include model vs market disagreement notes

- [x] 5.3 Add regression warnings
  - Check for teams with |actual_form - xg_form| > 0.2
  - Add `REGRESSION WARNING` to affected team sections
  - Include direction (overperforming/underperforming)

- [x] 5.4 Include contextual factors
  - Add rest days to team info
  - Add fatigue warnings for rest < 3 days
  - Include importance score context

## 6. Elo Backfill & Updates

- [x] 6.1 Create Elo initialization script (`scripts/init-team-ratings.ts`)
  - Set all existing teams to initial ratings (1500/1.0/1.0)
  - Mark with confidence='low'
  - Log initialization count
  - Added --train flag to train ratings using historical match results

- [x] 6.2 Implement post-match rating updates
  - Hook into result sync process
  - Update ratings when match completes
  - Only update if result is final (FT status)

- [x] 6.3 Backfill ratings from historical data
  - Use API-Football historical_matches table
  - Process chronologically to build accurate ratings
  - Rate limit to avoid overwhelming DB

## 7. Testing & Validation

- [x] 7.1 Unit tests for calculation functions
  - Test Elo update formula with known values
  - Test Poisson probability calculation
  - Test Dixon-Coles correction
  - Test EMA calculation

- [x] 7.2 Integration tests for match calculations
  - Test full calculation pipeline
  - Test with partial data
  - Created tests/unit/services/statistical-calculations-integration.test.ts

- [x] 7.3 Validate against known outcomes
  - Compare model probabilities to historical results
  - Calculate Brier score for calibration
  - Created scripts/validate-model.ts for running validation

## 8. Documentation

- [x] 8.1 Add inline documentation to calculation functions
  - Document formulas used
  - Document parameter choices
  - Include references to academic papers

- [x] 8.2 Update CLAUDE.md with new capabilities
  - Document statistical calculation system
  - Note integration with predictions
  - Explain value betting identification

## Dependencies & Parallelization

**Sequential dependencies:**
- 1.x (Schema) → 2.x (Engine) → 3.x (Service) → 4.x (Integration)
- 6.1 (Init) → 6.2 (Updates) → 6.3 (Backfill)

**Can run in parallel:**
- 2.2, 2.3, 2.4, 2.5 (different calculation modules)
- 5.1, 5.2, 5.3, 5.4 (different prompt sections)
- 7.1, 7.2 (different test types)
