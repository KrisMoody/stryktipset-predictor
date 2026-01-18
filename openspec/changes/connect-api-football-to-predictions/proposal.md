# Proposal: Connect API-Football to Predictions

## Why

The API-Football integration was built but never connected to the prediction pipeline. We have a working client, team matching, and data provider abstraction, but predictions still rely solely on fragile web scraping. This change completes the integration by wiring existing components together, enabling richer prediction context with official H2H data, injury information, and team statistics.

## Summary

Connect the existing API-Football infrastructure to the prediction pipeline so that H2H data, statistics, and injuries from API-Football are used when generating predictions.

## Problem Statement

The codebase has a fully implemented API-Football integration:
- ✅ HTTP client with rate limiting, caching, circuit breaker
- ✅ Team/league matching service
- ✅ Match enrichment (maps to API-Football fixture IDs)
- ✅ Data provider abstraction layer (`DataProviderFactory`)
- ✅ `ApiFootballProvider` with methods for statistics, H2H, injuries, team stats

However, **none of this data flows into predictions**:
- The `DataProviderFactory` is never imported or called anywhere
- Predictions use only web-scraped data from `match_scraped_data`
- The spec requirement "Prediction Service Context Preparation" is unimplemented

## Proposed Solution

Wire the existing `DataProviderFactory` into the prediction service to:
1. Fetch H2H, statistics, and injuries from API-Football when available
2. Fall back to scraped data when API-Football data is unavailable
3. Include API-Football data in the Claude AI context for predictions

This is a **wiring task**, not new capability development - all components exist.

## Scope

### In Scope
1. Initialize `DataProviderFactory` at application startup
2. Call provider in prediction service's `prepareMatchContext()` method
3. Format API-Football data for Claude AI prompt
4. Add feature flag to enable/disable API-Football in predictions
5. Update progressive scraper to skip data types when API-Football provides them

### Out of Scope
- New API-Football endpoints (already implemented)
- Team/league matching improvements (already working)
- Historical backfill (separate initiative)
- UI changes

## Value Proposition

| Benefit | Impact |
|---------|--------|
| More reliable data | API vs fragile web scraping |
| Richer H2H context | Official 10-match history vs scraped widget |
| Player injury data | Currently not in prediction context |
| Team season stats | Form, W-D-L, clean sheets from API |
| Reduced scraper load | Fewer data types to scrape |

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| API-Football unavailable | Low | Automatic fallback to scraped data |
| Incorrect team mapping | Low | 95%+ confidence already achieved |
| Increased latency | Medium | Data fetched async during enrichment, not at prediction time |
| API quota exhaustion | Low | Existing rate limiting + caching |

## Dependencies

- Existing `api-football-integration` spec (implemented)
- Runtime config `apiFootball.enabled` flag (exists)
- Team mappings in database (populated by enrichment)

## Success Criteria

1. Predictions include API-Football H2H data when available
2. Predictions include API-Football injury data when available
3. Fallback to scraped data works seamlessly
4. No increase in prediction generation time (data pre-fetched)
5. API quota stays within limits

## Estimated Effort

- **Tasks**: ~15 small tasks
- **Complexity**: Low (wiring existing components)
- **Testing**: Integration tests for provider fallback
