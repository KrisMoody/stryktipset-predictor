## Context

The ST-Predictor system currently uses Claude AI to generate match predictions based on raw data (xG, odds, form strings, H2H). While this works, research into football prediction systems shows that the best approaches combine:

1. **Statistical models** (Poisson, Elo) for objective baseline probabilities
2. **Machine learning** for pattern recognition and adjustment
3. **AI reasoning** for contextual factors the models can't capture

This design document outlines how to add a statistical calculation layer that provides Claude with mathematical baselines rather than relying on it to intuit probabilities from raw numbers.

**Stakeholders**: Prediction accuracy, coupon optimization, value betting identification

## Goals / Non-Goals

**Goals:**
- Calculate mathematical baseline probabilities using Dixon-Coles model
- Track team strength via Elo ratings with attack/defense separation
- Identify value betting opportunities via EV calculation
- Provide quantitative form metrics (EMA-based)
- Pre-calculate all statistics for fast prediction generation

**Non-Goals:**
- Replace Claude AI predictions (model provides baseline, AI adjusts)
- Real-time odds tracking (use existing scraped data)
- Player-level statistics (beyond injury availability)
- Automated betting (system provides recommendations only)

## Decisions

### Decision 1: Dixon-Coles Model for Probability Baseline

**What:** Implement bivariate Poisson distribution with Dixon-Coles correction for low-scoring matches.

**Why:**
- Industry standard for football prediction since 1997
- Corrects independent Poisson's underestimation of 0-0, 1-0, 0-1, 1-1 scores
- Includes time decay weighting (recent matches matter more)
- Well-documented with known parameters

**Implementation:**
```typescript
// Core formula
P(homeGoals, awayGoals) = poisson(homeGoals, λ_home) × poisson(awayGoals, λ_away) × τ(homeGoals, awayGoals, ρ)

where:
  λ_home = homeAttack × awayDefense × homeAdvantage
  λ_away = awayAttack × homeDefense
  τ = Dixon-Coles correction for low scores (0-0, 1-0, 0-1, 1-1)
  ρ = negative correlation parameter (typically -0.1 to -0.05)
```

**Alternatives considered:**
- Independent Poisson: Simpler but misses score correlations
- Machine learning only: Requires large training data we don't have
- Elo-only: Doesn't produce scoreline probabilities

### Decision 2: Hybrid Storage Model

**What:** Use two new tables: `team_ratings` (per-team) and `match_calculations` (per-match).

**Why:**
- Team ratings change slowly and apply across matches (efficient to store separately)
- Match calculations are specific to a matchup (need dedicated storage)
- Allows versioning of both rating models and calculations
- Supports historical analysis and model comparison

**Schema:**
```prisma
model team_ratings {
  id              Int      @id @default(autoincrement())
  team_id         Int
  rating_type     String   // 'elo', 'attack', 'defense'
  rating_value    Decimal
  model_version   String   // e.g., 'v1.0', 'v1.1'
  matches_played  Int      // Number of matches contributing to rating
  last_match_date DateTime
  created_at      DateTime
  updated_at      DateTime

  @@unique([team_id, rating_type, model_version])
}

model match_calculations {
  id                    Int      @id @default(autoincrement())
  match_id              Int      @unique

  // Dixon-Coles model outputs
  model_prob_home       Decimal  // P(home win) from model
  model_prob_draw       Decimal  // P(draw) from model
  model_prob_away       Decimal  // P(away win) from model
  expected_home_goals   Decimal  // λ_home
  expected_away_goals   Decimal  // λ_away

  // Fair probabilities (margin-removed from odds)
  fair_prob_home        Decimal
  fair_prob_draw        Decimal
  fair_prob_away        Decimal
  bookmaker_margin      Decimal  // Overround percentage

  // Expected Value calculations
  ev_home               Decimal  // EV of betting home
  ev_draw               Decimal
  ev_away               Decimal
  best_value_outcome    String   // '1', 'X', '2', or null if no value

  // Form metrics
  home_form_ema         Decimal  // EMA form score 0-1
  away_form_ema         Decimal
  home_xg_trend         Decimal  // xG differential trend
  away_xg_trend         Decimal

  // Contextual factors
  home_rest_days        Int
  away_rest_days        Int
  importance_score      Decimal  // 0-1 based on league position

  // Metadata
  model_version         String
  calculated_at         DateTime
}
```

**Alternatives considered:**
- Single table: Too wide, mixing team and match data
- Extend `match_scraped_data`: Loses type safety, harder to query
- In-memory only: Loses history, can't track model improvements

### Decision 3: Pre-Calculate During Draw Sync

**What:** Calculate all statistics immediately after match data is synced, store in database.

**Why:**
- Predictions become instantaneous (no calculation delay)
- Enables batch processing for all matches in a draw
- Allows quality checks before predictions
- Supports analytics on calculated values

**Timing in draw-sync flow:**
```
1. Fetch draw from Svenska Spel API
2. Upsert matches and odds
3. Trigger web scraping for xStats, etc.
4. [NEW] Calculate team ratings (if changed)
5. [NEW] Calculate match statistics
6. Generate embeddings (existing)
7. Generate predictions (existing, now with calculated context)
```

**Alternatives considered:**
- On-demand: Slower predictions, recalculates repeatedly
- Scheduled job: May be stale by prediction time
- Event-driven: More complex, same result as sync-time

### Decision 4: Elo Rating with Attack/Defense Split

**What:** Track three ratings per team: overall Elo, attack strength, defense strength.

**Why:**
- Overall Elo captures team quality but misses playing style
- A team with 1.8 xG and 1.5 xGA plays differently than 0.8 xG and 0.5 xGA
- Attack/defense split improves matchup predictions (strong attack vs weak defense)
- Aligns with Dixon-Coles model requirements

**Update formula:**
```typescript
// K-factor: how much each match affects rating
K = 20 × (1 + margin × 0.1) × homeAdvantageMultiplier

// Elo update
expected = 1 / (1 + 10^((opponentRating - teamRating) / 400))
actual = 1 for win, 0.5 for draw, 0 for loss
newRating = oldRating + K × (actual - expected)

// Attack/defense update (xG-based)
attackUpdate = actualxG - expectedxG
defenseUpdate = opponentxG - expectedOpponentxG
```

**Alternatives considered:**
- Simple Elo only: Misses attack/defense nuance
- Pi-ratings: More complex, marginal improvement
- FIFA rankings: Not available at club level

### Decision 5: EMA Form Score

**What:** Replace discrete W/D/L form string with continuous Exponential Moving Average.

**Why:**
- "WDLWW" treats a 5-0 win the same as a 1-0 win
- EMA naturally weights recent matches more
- Produces continuous value (0-1) for mathematical use
- Can incorporate xG-adjusted results (luck vs performance)

**Formula:**
```typescript
// Points-based EMA (α = 0.3 means 30% weight on latest)
newEMA = α × latestPoints + (1 - α) × previousEMA

where:
  α = 0.3 (smoothing factor)
  latestPoints = 3 for win, 1 for draw, 0 for loss

// xG-adjusted variant
adjustedPoints = 3 × (actualxG > opponentxG ? 1 : 0) +
                 1.5 × (|actualxG - opponentxG| < 0.3 ? 1 : 0)
```

**Alternatives considered:**
- Simple average: All matches weighted equally
- Weighted average: Requires defining weights
- Linear decay: Less smooth than exponential

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dixon-Coles requires historical data for parameter estimation | Initial predictions may be uncalibrated | Use league-average parameters initially, refine with backfill data |
| Elo ratings need 10+ matches to stabilize | New/promoted teams have uncertain ratings | Use league-average baseline, mark confidence level |
| Pre-calculation adds sync time | Slower draw updates | Calculate asynchronously after initial sync |
| Model vs AI disagreement | Confusing signals to Claude | Document when to trust model vs AI judgment |
| Storage growth | More database usage | Index efficiently, consider archival for old ratings |

## Migration Plan

1. **Phase 1: Schema & Basic Calculations**
   - Add new database tables
   - Implement Elo rating updates
   - Calculate fair odds from existing data

2. **Phase 2: Dixon-Coles Model**
   - Implement Poisson probability calculation
   - Add Dixon-Coles correction
   - Backfill team parameters from API-Football data

3. **Phase 3: Integration**
   - Update draw-sync to trigger calculations
   - Modify prediction-service to include calculated context
   - Add calculated stats to AI prompt

4. **Phase 4: Refinement**
   - Monitor model vs actual outcomes
   - Tune parameters based on historical performance
   - Add form metrics and contextual factors

**Rollback:** Calculations are additive; existing prediction flow continues to work without them.

## Open Questions

1. **Initial Elo values:** Should new teams start at 1500 (standard) or at league-average?
   - Recommendation: Use 1500 but mark as "low confidence" until 5+ matches

2. **Historical backfill scope:** How far back should we calculate ratings?
   - Recommendation: 3 seasons for top leagues (matches API-Football data)

3. **Model parameter tuning:** Should we auto-tune Dixon-Coles parameters or use published values?
   - Recommendation: Start with published values (ρ ≈ -0.1), tune later with sufficient data

4. **Claude prompt integration:** How prominently should model probabilities be shown to Claude?
   - Recommendation: Present as "Statistical baseline" section, explicitly encourage AI to adjust based on context
