# Proposal: Improve Scraper Resilience

## Summary
Replace the fragile Topptipset scraper with the reliable datepicker API for draw discovery, eliminating the primary source of production errors.

## Motivation
Analysis of 25 GitHub issues (automatically created via Bugsnag) revealed recurring patterns:
- **12 issues** related to Topptipset scraper failures (timeouts, data extraction failures, browser crashes)
- **4 issues** related to Svenska Spel API timeouts
- **2 issues** related to AI rate limiting
- **2 issues** related to database connection problems

The Topptipset scraper was originally needed because we assumed there was no `/draws` endpoint. However, investigation reveals that the **datepicker API works for Topptipset**:

```
GET /draw/1/results/datepicker/?product=topptipset&year=2026&month=1
```

This returns all draws with their state (`Open`, `Finalized`), allowing us to:
1. Filter for `drawState: "Open"` to get current active draws
2. Fetch each draw via the reliable `/draws/{drawNumber}` endpoint

This eliminates the need for scraping entirely for Topptipset draw discovery.

## Scope

### In Scope
- Replace scraper with datepicker API for Topptipset draw discovery
- Remove dependency on AI Scraper service for this use case
- Keep scraper code for potential future use (supplementary data)

### Out of Scope
- Circuit breaker patterns (no longer needed for this use case)
- Draw number caching (API is reliable)
- Database connection pool changes (separate concern)
- Playwright browser manager improvements

## Success Criteria
1. Topptipset scraper errors eliminated (12 of 25 issues resolved)
2. Topptipset draw sync as reliable as Stryktipset/Europatipset
3. No dependency on AI Scraper service for draw discovery

## Risks
- Datepicker API may not include very recent draws (mitigated: check current + next month)
- Minor behavior change in draw discovery timing

## Dependencies
- Existing `fetchAvailableDraws()` method already uses datepicker API
- No new dependencies required

## Stakeholders
- System reliability: Primary beneficiary
- End users: Better uptime for predictions
- Development: Clearer error diagnostics

## Timeline
This is a medium-sized change affecting 3-4 files with focused scope.
