## Context

The system uses multiple data sources for match enrichment: API-Football (primary) and web scraping via AI service (fallback). Both are experiencing failures that reduce data quality for predictions.

**Stakeholders**: Match enrichment pipeline, prediction service, end users viewing match data.

## Goals / Non-Goals

### Goals
- Fix the API-Football injuries endpoint missing season parameter
- Improve AI scraper resilience to browser lifecycle errors
- Improve observability of rate limiter and quota state

### Non-Goals
- Fix the root cause in the remote AI scraper Python service (that's a separate deployment)
- Change rate limiting thresholds
- Add new data sources

## Decisions

### Decision 1: Add season to team-based injury queries

**What**: When fetching injuries by `team` parameter (fallback when no fixture ID), include the `season` parameter derived from match start_time.

**Why**: API-Football documentation shows season as optional, but the actual API requires it for team-based queries. The error message confirms: `{"season":"The Season field is required."}`.

**Implementation**:
```typescript
// In fetchAndStoreInjuries, when using team parameter:
const season = new Date(match.start_time).getFullYear()
const params = { team: teamId, season }
```

**Alternatives considered**:
- Always use fixture-based queries: Not possible - fixture IDs aren't always available for upcoming matches
- Catch the error and retry with season: Adds unnecessary API calls

### Decision 2: Improve AI scraper error categorization

**What**: Distinguish between transient errors (network timeouts) vs persistent errors (browser lifecycle failures) in the AI scraper client.

**Why**: The `Browser.new_context: Target page, context or browser has been closed` error indicates the remote service needs a restart, not retries. The circuit breaker should open faster for these errors.

**Implementation**:
- Add error type detection in `AIScraperClient`
- Mark browser lifecycle errors as "service unhealthy"
- Use health check endpoint to verify service state before batch operations

### Decision 3: Add pre-scrape health check

**What**: Call the AI scraper health endpoint before starting a scrape batch to avoid wasting time on sequential failures.

**Why**: Currently, each scrape type fails independently after ~400ms, taking 2.6s total. A health check can fail-fast in one call.

**Implementation**:
```typescript
// In ScraperServiceV3.scrapeMatch:
const isHealthy = await this.aiScraperClient.isHealthy()
if (!isHealthy) {
  logger.warn('[Scraper Service V3] AI scraper unhealthy, skipping AI scraping')
  // Fall through to DOM fallback or return partial results
}
```

### Decision 4: Improve rate limiter logging

**What**: When rate limiter enforces a long wait (>10s), log the current quota state.

**Why**: The 57+ second waits suggest quota exhaustion but the logs don't show quota context, making debugging difficult.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Health check adds latency | Only ~100-200ms overhead; saves 2+ seconds when service is down |
| Season parameter might not work for all leagues | Already works for team statistics; consistent approach |
| Circuit breaker may open too aggressively | Keep existing thresholds; only change error categorization |

## Migration Plan

1. Deploy changes to development environment
2. Monitor logs for improved error visibility
3. Verify injuries fetching works for upcoming matches
4. Deploy to production

**Rollback**: Revert the PR; no database changes required.

## Open Questions

None - the fixes are straightforward parameter additions and improved error handling.
