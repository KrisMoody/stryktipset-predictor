## 1. API Endpoints

- [x] 1.1 Create `GET /api/matches/:id/calculations` endpoint returning `match_calculations` data
- [x] 1.2 Create `GET /api/teams/:id/ratings` endpoint returning team Elo, attack, defense ratings
- [x] 1.3 Create `GET /api/admin/team-ratings` endpoint for admin listing all team ratings
- [x] 1.4 Extend draw API to include `match_calculations` in match data (optional query param)
  - Skipped: Calculations are lazy-loaded via the calculations endpoint instead

## 2. Components - Match Model Analysis

- [x] 2.1 Create `components/match/ModelAnalysis.vue` - main expandable section
  - Probability comparison (model vs market)
  - Expected goals display
  - EV calculations with value highlighting
  - Form metrics with visual bars
  - Contextual factors (rest days)
- [x] 2.2 Create `components/match/ValueIndicator.vue` - small VALUE badge
  - Shows when `best_value_outcome` is set and EV > threshold
  - Color-coded by EV magnitude
- [x] 2.3 Create `components/match/TeamRatingTooltip.vue` - hover tooltip for team ratings
  - Elo with confidence badge
  - Attack/defense relative to 1.0
  - Matches played count

## 3. Draw Page Integration

- [x] 3.1 Add "Model Analysis" button to expandable sections in `pages/draw/[id]/index.vue`
- [x] 3.2 Integrate `ModelAnalysis` component into draw page
- [x] 3.3 Add VALUE badge to AI Prediction section when value opportunity exists
  - Note: VALUE badge shows in ModelAnalysis section when expanded
- [x] 3.4 Add TeamRatingTooltip to team names in match card
- [x] 3.5 Add regression warning badge when team is flagged
  - Note: Shown in ModelAnalysis component when expanded

## 4. Analytics Page Enhancement

- [x] 4.1 Add "Model Performance" card to analytics page
  - Model accuracy vs actual outcomes
  - Brier score
  - Calibration (predicted vs actual probability)
- [x] 4.2 Add EV tracking - value bet hit rate and count

## 5. Admin Page Enhancement

- [x] 5.1 Add "Team Ratings" section to admin page
  - List all teams with ratings
  - Filter by confidence level
  - Summary stats (counts by confidence)
- [x] 5.2 Add model version indicator
  - Note: Displayed in ModelAnalysis component data quality section
- [ ] 5.3 Allow admin to reinitialize ratings for a team (triggers recalculation)
  - Deferred: Use CLI scripts for now (`npx tsx scripts/init-team-ratings.ts`)

## 6. Testing

- [ ] 6.1 Unit tests for new API endpoints
- [ ] 6.2 Component tests for ModelAnalysis, ValueIndicator, TeamRatingTooltip
- [ ] 6.3 Integration test - verify model data displays correctly on draw page

## 7. Documentation

- [ ] 7.1 Update CLAUDE.md with UI component descriptions
- [ ] 7.2 Add inline comments explaining model outputs in components
  - Note: Components already include inline comments
