## Context

The ST-Predictor system has odds from Svenska Spel (stryktipset, oddset) stored in the `match_odds` table. These are the odds we bet against, but they don't reflect broader market sentiment. API-Football provides pre-match odds from 20+ bookmakers including "sharp" bookmakers like Pinnacle whose lines are considered market-efficient.

**Current data flow:**
1. Draw syncs from Svenska Spel → odds stored with `source='stryktipset'`
2. Prediction reads only Svenska Spel odds from `match_odds`
3. No market consensus or value comparison available

**Problem:** Predictions lack market intelligence that could improve accuracy and identify value opportunities.

## Goals / Non-Goals

**Goals:**
- Fetch 1X2 odds from multiple bookmakers via API-Football
- Store each bookmaker's odds in `match_odds` with distinct `source` values
- Calculate market consensus (average implied probabilities)
- Include market comparison in prediction context
- Help identify value bets (where Svenska Spel odds differ from market)

**Non-Goals:**
- Real-time odds updates (pre-match snapshot is sufficient)
- Storing every bet type (over/under, BTTS, etc.) - only 1X2 initially
- Automated arbitrage detection

## Decisions

### Decision 1: Store in existing `match_odds` table

**What:** Use the existing `match_odds` table with `source` field set to bookmaker name (e.g., "bet365", "pinnacle", "unibet").

**Why:**
- Schema already supports multiple sources
- No migration needed
- Consistent with existing Svenska Spel odds storage

**Alternative considered:** Create separate `market_odds` table → Rejected: unnecessary complexity

### Decision 2: Focus on 1X2 Match Winner bet type only

**What:** Fetch only the "Match Winner" (1X2) bet type from API-Football, ignoring over/under, BTTS, etc.

**Why:**
- 1X2 is the only bet type relevant to Stryktipset/Europatipset
- Reduces data storage and processing
- Bet type ID 1 = "Match Winner" in API-Football

### Decision 3: Store top bookmakers only

**What:** Store odds from a curated list of reliable bookmakers:
- Pinnacle (sharp bookmaker, efficient lines)
- Bet365 (high liquidity)
- Unibet (commonly available)
- 1xBet (wide coverage)
- Betfair (exchange, reflects true market)

**Why:**
- Limits storage while capturing market breadth
- Includes both sharp and soft bookmakers
- These are consistently available across fixtures

### Decision 4: Calculate market consensus

**What:** Create a synthetic `source='market_consensus'` record with:
- Average implied probability across all bookmakers
- Minimum margin-adjusted fair odds
- Standard deviation to measure market disagreement

**Why:**
- Gives Claude a single "market view" to compare against
- Highlights fixtures with high bookmaker disagreement (potential value/uncertainty)

### Decision 5: Cache for 30 minutes

**What:** Odds are cached for 30 minutes. After that, refetch if requested.

**Why:**
- Odds change more frequently than other data
- 30 minutes balances freshness vs API quota
- Pre-match odds don't change drastically far from kickoff

## Data Flow

```
1. Automatic fetch triggered (enrichment or prediction)
      ↓
2. Check if match has api_football_fixture_id
      ↓
3. Fetch from API-Football /odds?fixture={id}&bet=1
      ↓
4. Parse response, filter to target bookmakers
      ↓
5. Upsert each bookmaker's odds into match_odds
      ↓
6. Calculate and store market_consensus record
      ↓
7. When preparing prediction context:
   - Include Svenska Spel odds (existing)
   - Include market consensus
   - Flag discrepancies > 5% implied probability
```

## API Response Structure

```json
{
  "response": [{
    "fixture": { "id": 123456 },
    "bookmakers": [{
      "id": 6,
      "name": "Bet365",
      "bets": [{
        "id": 1,
        "name": "Match Winner",
        "values": [
          { "value": "Home", "odd": "2.10" },
          { "value": "Draw", "odd": "3.40" },
          { "value": "Away", "odd": "3.20" }
        ]
      }]
    }]
  }]
}
```

## Prediction Context Addition

```
MARKET ODDS COMPARISON
=======================
Market Consensus: Home 42.3% | Draw 28.5% | Away 29.2%
Svenska Spel:     Home 45.0% | Draw 27.0% | Away 28.0%

⚠️ VALUE SIGNAL: Svenska Spel overvalues Home by 2.7% vs market

Bookmaker Breakdown (1X2):
- Pinnacle:  2.25 / 3.30 / 3.10 (sharp)
- Bet365:    2.10 / 3.40 / 3.20
- Unibet:    2.15 / 3.35 / 3.15
```

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Odds not available for all fixtures | Missing market data | Graceful degradation - proceed without |
| API quota usage (+1 per match) | ~13 extra calls per draw | Within 7,500/day limit |
| Bookmaker coverage varies by league | Inconsistent data | Filter to available bookmakers |
| Stale odds near kickoff | Outdated market view | 30-min cache, note collection time |

## Open Questions

1. Should we weight sharp bookmakers (Pinnacle) more heavily in consensus? → Start with equal weights
2. Should we track odds movement over time? → Not initially, may add later
3. Should we fetch odds for historical matches for backtesting? → Future enhancement
