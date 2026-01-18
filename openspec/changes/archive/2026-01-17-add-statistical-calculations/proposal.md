# Change: Add Statistical Calculations for Prediction Enhancement

## Why

The current prediction system is **data-rich but calculation-poor**. We collect excellent raw data (xG, odds, form, H2H) but rely entirely on Claude AI to synthesize it intuitively. Research shows the best prediction systems combine **statistical rigor** with **AI flexibility**.

Key gaps identified:
1. **No mathematical probability model** - Claude "guesses" probabilities rather than calculating from a statistical foundation
2. **No Expected Value (EV) calculation** - Cannot identify value bets mathematically
3. **No team strength ratings** - No objective baseline for team quality (Elo/Pi-ratings)
4. **Form is qualitative, not quantitative** - "WDLWW" doesn't capture opposition strength or margin
5. **No fair odds calculation** - Cannot separate true probability from bookmaker margin

## What Changes

### Core Statistical Engine
- Implement **Dixon-Coles bivariate Poisson model** for baseline probability calculation
- Add **Elo rating system** for team strength tracking
- Calculate **fair probabilities** by removing bookmaker margin from odds
- Compute **Expected Value (EV)** for each outcome vs. market odds

### Enhanced Form Metrics
- Replace W/D/L string with **Exponential Moving Average (EMA) form score**
- Add **xG differential trending** (over/underperformance detection)
- Implement **opposition-adjusted form** (weight by opponent strength)

### Contextual Features
- Calculate **rest days** between matches (fatigue indicator)
- Compute **match importance score** (league position stakes)
- Track **lineup stability** (changes vs typical XI)

### New Database Tables
- `team_ratings` - Store Elo/strength ratings with history
- `match_calculations` - Store per-match computed statistics

### Prediction Service Integration
- Pass model-calculated probabilities to Claude as **baseline reference**
- Include EV calculations in AI context
- Highlight statistical signals (regression candidates, value opportunities)

## Impact

- **Affected specs**: New capability `statistical-calculations`, modifies `api-football-integration` (data source for historical stats)
- **Affected code**:
  - New: `server/services/statistical-calculations/` module
  - Modified: `server/services/prediction-service.ts` (context preparation)
  - Modified: `server/services/draw-sync.ts` (trigger calculations)
  - New: `prisma/schema.prisma` (new tables)
- **Breaking changes**: None - additive enhancement
- **Performance**: Pre-calculation approach adds ~2-5 seconds to draw sync but makes predictions faster
