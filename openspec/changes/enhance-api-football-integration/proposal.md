# Change: Enhance API-Football Integration

## Why

The current API-Football integration (40/47 tasks complete in `connect-api-football-to-predictions`) provides basic data enrichment but doesn't leverage several high-value endpoints that could significantly improve prediction accuracy. Additionally, a documentation audit revealed minor type definition issues and the remaining integration tests need completion.

This proposal addresses three goals:
1. **Complete** the remaining 7 tasks from the existing change
2. **Validate** the implementation against official API-Football documentation
3. **Enhance** with high-value endpoints not currently used

## What Changes

### 1. Complete Existing Change (connect-api-football-to-predictions)
- Complete 7 remaining integration/validation tasks
- Run end-to-end tests for enrichment → storage → prediction flow
- Validate fallback paths when API-Football is unavailable
- Manual validation of data flow

### 2. Fix Documentation Mismatches
- **Type Fix**: `ApiFootballInjury.player.type` should be injury type ("Muscle Injury"), not status ("Missing Fixture")
- **Type Fix**: `ApiFootballInjury.player.reason` is detailed description ("Hamstring"), not category
- **Status Response**: Minor structure clarification for `/status` endpoint response

### 3. Add High-Value Missing Endpoints

#### `/predictions` Endpoint (HIGH PRIORITY)
API-Football provides AI-powered predictions including:
- Win/draw/loss percentages
- Predicted goals per team
- Betting advice ("Double chance Home or Draw")
- Team comparison metrics (attack/defense strength)
- Poisson distribution analysis
- H2H historical summary

**Value**: Can serve as baseline comparison for our Claude-generated predictions.

#### `/teams/statistics` Endpoint (HIGH PRIORITY)
Comprehensive season statistics:
- Form string (e.g., "WWDLW")
- Win/draw/loss splits (home/away/total)
- Goals scored/conceded with averages
- Clean sheets and failed-to-score counts
- Biggest wins/losses and streaks
- Penalty statistics
- Card distribution by time period

**Value**: Currently fetching fixture-level stats; season stats provide better context.

#### `/standings` Endpoint (MEDIUM PRIORITY)
League standings with:
- Current rank and points
- Goal difference
- Home/away form splits
- Promotion/relegation status

**Value**: Position in table is crucial context for predictions.

#### `/fixtures/lineups` Endpoint (MEDIUM PRIORITY)
Confirmed lineups available ~1 hour before kickoff:
- Starting XI with positions
- Formation
- Substitutes
- Coach information

**Value**: Late-breaking lineup info before betting deadline.

### 4. Integrate New Data into Prediction Context
- Add API-Football predictions as "EXTERNAL MODEL COMPARISON" section
- Add team season statistics to existing context
- Add standings data (league position, form)
- Add lineup data when available before deadline

## Impact

- **Affected specs**: `api-football-integration`
- **Affected code**:
  - `server/services/api-football/types.ts` - Add new response types
  - `server/services/api-football/match-enrichment.ts` - Add new data fetching methods
  - `server/services/prediction-service.ts` - Extend context with new data
  - Runtime config - Add new data type toggles

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API quota exhaustion | Medium | High | Configure which endpoints to enable via feature flags |
| Increased latency | Low | Medium | Fetch data during enrichment phase, not prediction time |
| Breaking changes from new types | Low | Low | Additive changes only, existing flows unaffected |

## Success Criteria

1. All 47 tasks from `connect-api-football-to-predictions` marked complete
2. Type definitions validated against API documentation
3. `/predictions` endpoint integrated and returning data
4. `/teams/statistics` endpoint integrated for season context
5. Prediction prompts include new data sections when available
6. Feature flags allow selective enabling of new endpoints
