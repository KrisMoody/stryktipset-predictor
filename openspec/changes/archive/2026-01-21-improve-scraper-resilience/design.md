# Design: Improve Scraper Resilience

## Overview
Replace the fragile Topptipset scraper with the reliable datepicker API for draw discovery.

### Discovery: Datepicker API Works for Topptipset

Investigation revealed that while Topptipset lacks a `/draws` list endpoint, the **datepicker API works**:

```
GET /draw/1/results/datepicker/?product=topptipset&year=2026&month=1
```

Response includes:
```json
{
  "resultDates": [
    {
      "drawNumber": 3922,
      "drawState": "Open",
      "closeDate": "2026-01-18T20:00:00+01:00"
    },
    {
      "drawNumber": 3923,
      "drawState": "Open",
      "closeDate": "2026-01-19T00:00:00+01:00"
    }
  ]
}
```

This allows filtering for `drawState: "Open"` to get current active draws.

## Architecture

### Current Flow (Fragile)
```
fetchTopptipsetCurrentDraws()
    └── scrapeTopptipsetDrawNumbers()           ← External AI Scraper dependency
            └── fetch(aiScraperUrl/scrape-raw)  ← 90s timeout, browser crashes
                    └── Parse window._svs.draw.data.draws  ← Brittle extraction
```

### Proposed Flow (Reliable)
```
fetchTopptipsetCurrentDraws()
    └── fetchAvailableDraws(currentYear, currentMonth)  ← Existing API method
    └── fetchAvailableDraws(currentYear, nextMonth)     ← Cover month boundaries
    └── Filter for drawState === "Open"
    └── Fetch each draw via fetchDrawWithMultifetch()   ← Existing reliable method
```

## Implementation

### Changes to `svenska-spel-api.ts`

Replace `fetchTopptipsetCurrentDraws()` implementation:

**Before** (lines 459-515):
- Imports and calls `scrapeTopptipsetDrawNumbers()`
- Depends on AI Scraper service
- 12 production errors from scraper failures

**After**:
- Call `fetchAvailableDraws()` for current and next month
- Filter results for `drawState === "Open"`
- No external scraper dependency
- Same reliability as Stryktipset/Europatipset

### Edge Cases

1. **Month boundary**: Draws opening late in month may appear in next month's datepicker
   - Solution: Query both current month and next month

2. **No open draws**: During off-season or between draws
   - Solution: Return empty array (same as current behavior)

3. **Datepicker returns finalized draws only**: Very new draws may not appear
   - Solution: The datepicker returns "Open" state draws (verified in testing)

## Files Modified

1. `server/services/svenska-spel-api.ts` - Replace `fetchTopptipsetCurrentDraws()` implementation

## Files Unchanged (kept for future use)

1. `server/services/scraper/topptipset-draw-numbers.ts` - May be useful for other data

## Testing Strategy

1. Verify datepicker returns current open draws
2. Test month boundary handling
3. Compare draw numbers with current scraper output
4. Monitor production for 1 week post-deployment
