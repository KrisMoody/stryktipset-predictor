<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Statistical Calculations System

The project includes a statistical model for football match prediction located in `server/services/statistical-calculations/`.

## Architecture

```
server/services/statistical-calculations/
├── index.ts           # Main service - orchestrates calculations
├── elo-rating.ts      # Elo rating system with attack/defense separation
├── dixon-coles.ts     # Bivariate Poisson model for match probabilities
├── form-calculator.ts # EMA form metrics and xG trend analysis
├── value-calculator.ts# Fair odds and Expected Value calculations
└── types.ts           # TypeScript interfaces and default config
```

## Database Tables

- **team_ratings**: Stores Elo, attack, and defense ratings per team
  - Unique constraint on (team_id, rating_type, model_version)
  - Confidence levels: 'low' | 'medium' | 'high'

- **match_calculations**: Stores calculated probabilities and value metrics per match
  - Model probabilities (1X2), fair probabilities, EV for each outcome
  - Form metrics, contextual factors (rest days, importance)
  - Data quality: 'full' | 'partial' | 'minimal'

## Key Algorithms

### Elo Rating System
- Initial rating: 1500
- Separate attack/defense strength components
- K-factor adjusts based on goal margin and home advantage
- Updated automatically after match completion (FT status)

### Dixon-Coles Model
- Bivariate Poisson distribution for goal scoring
- Correction factor (tau/rho) for low-scoring matches (0-0, 1-0, 0-1, 1-1)
- Calculates expected goals (lambda) from team ratings
- Sums over scorelines to get 1X2 probabilities

### Form Calculator
- Exponential Moving Average (alpha=0.3) on recent results
- xG-based form trend detection
- Regression candidate identification (|actual - xG| > 0.2)

### Value Calculator
- Removes bookmaker margin to get fair probabilities
- EV = (model_probability × odds) - 1
- Kelly Criterion for bet sizing (quarter Kelly, capped at 10%)
- Value threshold: 3% edge (configurable)

## Integration Points

### Draw Sync (`server/services/draw-sync.ts`)
- Triggers `recalculateDrawStatistics()` after scraping completes
- Updates team ratings via `updateRatingsForCompletedMatch()` when matches finish

### Prediction Service (`server/services/prediction-service.ts`)
- Adds `STATISTICAL MODEL BASELINE` section to Claude prompts
- Includes model probabilities, fair odds, EV calculations
- Flags `VALUE OPPORTUNITY` for EV > 5%
- Flags `REGRESSION WARNING` for over/underperforming teams
- Includes contextual factors (rest days, fatigue warnings)

## Scripts

- `npx tsx scripts/init-team-ratings.ts` - Initialize all teams with default ratings
- `npx tsx scripts/init-team-ratings.ts --train` - Train ratings from historical match data
- `npx tsx scripts/backfill-calculations.ts` - Calculate statistics for existing matches
- `npx tsx scripts/validate-model.ts` - Validate model accuracy with Brier score

## Configuration

Default values in `types.ts`:
```typescript
DEFAULT_CONFIG = {
  initialElo: 1500,
  kFactor: 32,
  homeAdvantage: 1.25,
  rho: -0.1,           // Dixon-Coles correlation
  maxGoals: 10,        // Scoreline summation limit
  evThreshold: 0.03,   // 3% minimum edge
  formAlpha: 0.3,      // EMA smoothing
  formLookback: 10,    // Recent matches for form
}
```