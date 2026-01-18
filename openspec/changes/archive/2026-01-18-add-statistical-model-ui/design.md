## Context

The statistical calculations system computes:
- **Dixon-Coles probabilities**: Bivariate Poisson model for 1X2 outcomes
- **Fair probabilities**: Market odds with margin removed
- **Expected Values (EV)**: Model prob × odds - 1 for each outcome
- **Team ratings**: Elo (1500 baseline), attack/defense strength (1.0 baseline)
- **Form metrics**: EMA-based scores (0-1) and xG trends
- **Contextual factors**: Rest days, importance scores

This data is stored in `match_calculations` and `team_ratings` tables but not exposed in the UI.

## Goals

1. Display model outputs to users in an intuitive, actionable format
2. Highlight value opportunities (positive EV bets)
3. Surface regression warnings for informed decision-making
4. Keep UI clean—don't overwhelm with numbers

## Non-Goals

1. Allow users to configure model parameters
2. Show raw mathematical formulas
3. Replace AI predictions—complement them

## Decisions

### Decision 1: Progressive disclosure via expandable section
- **What**: Add "Model Analysis" as a new expandable section alongside existing Statistics, H2H, Analysis sections
- **Why**: Keeps the main match card clean; users who want depth can expand
- **Alternatives considered**:
  - Inline in match card (rejected: too cluttered)
  - Separate page (rejected: loses context)

### Decision 2: Visual probability comparison
- **What**: Show model probs vs market probs as bar chart or side-by-side comparison
- **Why**: Visual diff immediately shows where model disagrees with market
- **Implementation**: Horizontal stacked bars or simple table with diff highlighted

### Decision 3: Value badge on match card (always visible)
- **What**: Small "VALUE" badge when best_value_outcome has EV > evThreshold (3%)
- **Why**: Users scanning draws should instantly see value opportunities
- **Placement**: Near the AI Prediction section in match card

### Decision 4: Team ratings in tooltip/popover
- **What**: Hover on team name to see Elo, attack, defense ratings
- **Why**: Doesn't clutter UI but info is accessible
- **Alternative**: Could also show in expanded Model Analysis section

### Decision 5: API-first approach
- **What**: Fetch `match_calculations` via API endpoint, don't pre-load with draw data
- **Why**: Calculations data is optional—avoid slowing down main draw load
- **Endpoint**: `GET /api/matches/:id/calculations` returns calculations + ratings

## UI Mockups (Conceptual)

### Match Card (Collapsed)
```
┌─────────────────────────────────────────────────────────────┐
│ 1  Arsenal                                                   │
│    Chelsea                                                   │
│    Premier League • Dec 15, 14:00                           │
│                                                              │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐│
│ │ Market Odds │  │ Distribution│  │ AI Prediction           ││
│ │ 1: 1.90     │  │ [chart]     │  │ 1 (High confidence)     ││
│ │ X: 3.50     │  │             │  │ 1: 48% X: 27% 2: 25%    ││
│ │ 2: 4.20     │  │             │  │ 🎯 Spik  ✨ VALUE       ││
│ └─────────────┘  └─────────────┘  └─────────────────────────┘│
│                                                              │
│ [AI Analysis] [Statistics] [H2H] [Odds] [📊 Model Analysis] │
└─────────────────────────────────────────────────────────────┘
```

### Model Analysis Section (Expanded)
```
┌─────────────────────────────────────────────────────────────┐
│ 📊 MODEL ANALYSIS                                           │
│                                                              │
│ PROBABILITIES              Model    Market    Diff          │
│ Home (1)                   52.1%    52.6%    -0.5%          │
│ Draw (X)                   25.3%    28.6%    -3.3%          │
│ Away (2)                   22.6%    23.8%    -1.2%          │
│ ────────────────────────────────────────────────────────────│
│ Expected Goals: Arsenal 1.68  Chelsea 1.12                  │
│ Bookmaker Margin: 4.8%                                      │
│                                                              │
│ EXPECTED VALUE                                               │
│ Home (1):  +3.2%  ✓ VALUE                                   │
│ Draw (X):  -1.8%                                            │
│ Away (2):  -5.1%                                            │
│                                                              │
│ FORM                                                         │
│ Arsenal:  ████████░░ 0.78  (Stable)                         │
│ Chelsea:  ██████░░░░ 0.58  ⚠️ Overperforming xG            │
│                                                              │
│ CONTEXT                                                      │
│ Arsenal: 6 days rest  •  Chelsea: 3 days rest               │
└─────────────────────────────────────────────────────────────┘
```

### Team Rating Tooltip
```
┌────────────────────────────┐
│ Arsenal                     │
│ Elo: 1682 (High confidence)│
│ Attack: 1.28               │
│ Defense: 0.92              │
│ Based on 38 matches        │
└────────────────────────────┘
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Too much data overwhelms users | Progressive disclosure via expandable sections; value badges are summary |
| Calculations not yet computed for match | Show "Model data unavailable" gracefully; don't break UI |
| Model disagrees strongly with AI | Both are tools—show both, let user decide |
| Performance impact | Lazy-load calculations on section expand |

## Migration Plan

No migration needed—additive UI changes only.

## Open Questions

1. **Should value badge threshold be configurable per user?** (Default: 3% EV)
2. **Show model probabilities in AI prompt context panel?** Currently shown to Claude but not to users reviewing the prediction.
