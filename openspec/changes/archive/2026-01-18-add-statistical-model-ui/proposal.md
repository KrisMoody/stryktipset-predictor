# Change: Add Statistical Model UI Components

## Why

The statistical calculations system (Elo ratings, Dixon-Coles probabilities, EV calculations, form metrics) is implemented in the backend but none of this valuable data is visible to users. Users need to see:
- Model-based probabilities vs market odds to understand value opportunities
- Team ratings to assess relative team strength
- Form metrics and regression warnings to contextualize predictions
- Fair odds and EV calculations to make informed betting decisions

## What Changes

### 1. Match Detail View Enhancements (Draw Page)
- **New "Model Analysis" expandable section** per match showing:
  - Dixon-Coles model probabilities (1/X/2) with visual comparison to market odds
  - Expected goals (λ_home / λ_away) from the model
  - Fair odds (margin-removed) and bookmaker margin percentage
  - EV for each outcome with positive EV highlighted as value bets
  - Team form metrics (EMA scores) with visual indicators
  - Regression warnings when teams are over/underperforming xG

### 2. Team Ratings Display
- **Elo/Attack/Defense ratings** shown in match header or tooltip:
  - Elo rating with confidence indicator (low/medium/high)
  - Attack/defense strength relative to baseline (1.0)
  - Matches played for rating context

### 3. Value Indicators
- **Visual "VALUE" badge** when EV > 3% (configurable threshold)
- **Regression warning badge** when team flagged for potential regression

### 4. Analytics Page Enhancement
- **Model accuracy section**: Track how Dixon-Coles predictions compare to actual outcomes
- **Calibration charts**: Are model probabilities well-calibrated?

### 5. Admin Page Enhancement
- **Team Ratings Overview**: View/edit team ratings with confidence levels
- **Model Performance Dashboard**: Track model accuracy over time

## Impact

- **Affected specs**: Creates new `statistical-model-ui` capability
- **Affected code**:
  - [pages/draw/[id]/index.vue](pages/draw/[id]/index.vue) - Add Model Analysis section
  - New component: `components/match/ModelAnalysis.vue`
  - New component: `components/match/ValueIndicator.vue`
  - New component: `components/match/TeamRatings.vue`
  - [pages/analytics.vue](pages/analytics.vue) - Add model performance section
  - [pages/admin.vue](pages/admin.vue) - Add team ratings management
  - New API endpoints for fetching calculations data

## Non-Goals

- Editing model configuration from UI (stays in code/env)
- Real-time recalculation (uses pre-computed values)
- Advanced visualization (keep it simple, functional)
