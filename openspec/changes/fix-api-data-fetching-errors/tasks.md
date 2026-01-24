## 1. Fix API-Football Injuries Endpoint

- [x] 1.1 Update `fetchAndStoreInjuries` in `match-enrichment.ts` to accept match start_time
- [x] 1.2 Add season parameter to team-based injury queries (extract year from match start_time)
- [ ] 1.3 Test injuries fetching for upcoming matches manually

## 2. Improve Rate Limiter Logging

- [x] 2.1 Add quota state logging in `client.ts` when wait exceeds 10 seconds
- [x] 2.2 Log remaining quota when approaching daily limit (90%)

## 3. Add AI Scraper Health Check

- [x] 3.1 Add `isHealthy()` pre-check in `ScraperServiceV3.scrapeMatch` before attempting AI scrapes
- [x] 3.2 Skip all AI scraping if health check fails (single early exit)
- [x] 3.3 Add logging for health check results

## 4. Implement Error Categorization

- [x] 4.1 Add `categorizeError()` function in `ai-scraper-client.ts`
- [x] 4.2 Detect browser lifecycle errors (contains "Browser.new_context" or "browser has been closed")
- [x] 4.3 Adjust circuit breaker behavior for service-level vs transient errors
- [x] 4.4 Add error category to log output

## 5. Validation

- [x] 5.1 Run type checks (`yarn typecheck`)
- [ ] 5.2 Test injuries fetching for upcoming matches manually
- [ ] 5.3 Verify health check prevents wasted sequential failures
- [ ] 5.4 Verify improved logging shows quota state on long waits
