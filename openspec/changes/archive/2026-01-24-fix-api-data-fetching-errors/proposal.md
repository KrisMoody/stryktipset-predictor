# Change: Fix API Data Fetching Errors

## Why

The system is experiencing multiple data fetching failures that degrade match enrichment quality:

1. **API-Football `/injuries` endpoint fails** with `"The Season field is required"` when fetching by team ID (without fixture ID). The current implementation doesn't pass the season parameter for team-based injury queries.

2. **AI Scraper service fails** with `Browser.new_context: Target page, context or browser has been closed` - the remote Playwright browser is being terminated prematurely, causing all scrape types (xStats, statistics, headToHead, news, lineup) to fail.

3. **Excessive rate limiter waits** (57+ seconds) suggest either aggressive throttling or quota exhaustion issues that need better visibility and handling.

## What Changes

### API-Football Injuries Fix
- Add `season` parameter to team-based injury queries (when no fixture ID available)
- Extract season from match start_time, consistent with how team statistics works

### AI Scraper Resilience
- Improve error detection for browser lifecycle errors
- Add health check before batch scraping attempts
- Implement smarter circuit breaker that distinguishes transient vs persistent failures

### Rate Limiter Improvements
- Add better logging for quota state when long waits occur
- Surface quota exhaustion clearly in logs

## Impact

- Affected specs: `api-football-integration`, `scraper-resilience`
- Affected code:
  - `server/services/api-football/match-enrichment.ts` (injuries fetching)
  - `server/services/scraper/scraper-service-v3.ts` (error handling)
  - `server/services/scraper/ai-scraper-client.ts` (health checks)
  - `server/services/api-football/client.ts` (rate limiter logging)
