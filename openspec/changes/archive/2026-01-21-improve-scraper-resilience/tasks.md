# Tasks: Improve Scraper Resilience

## Phase 1: Replace Scraper with Datepicker API

### Task 1.1: Update fetchTopptipsetCurrentDraws()
- [x] Modify `server/services/svenska-spel-api.ts`
- [x] Remove scraper import and call
- [x] Call `fetchAvailableDraws()` for current month
- [x] Call `fetchAvailableDraws()` for next month (handle year boundary)
- [x] Filter results for `drawState === "Open"`
- [x] Fetch each open draw via `fetchDrawWithMultifetch()`
- **Verification**: ✅ Topptipset draws sync without scraper (commit f33e3a4)

### Task 1.2: Handle month/year boundaries
- [x] Calculate current and next month correctly (Dec → Jan)
- [x] Handle year rollover in next month calculation
- [x] Deduplicate draw numbers from both month queries
- **Verification**: ✅ Draws at month boundaries are discovered (lines 480-498)

### Task 1.3: Add logging for new flow
- [x] Log datepicker API calls
- [x] Log number of open draws found
- [x] Log any errors from datepicker API
- **Verification**: ✅ Logs show clear flow through new code path (lines 478, 502-508, 533-535)

## Phase 2: Testing

### Task 2.1: Manual verification
- [x] Run sync and verify Topptipset draws are discovered
- [x] Compare results with current scraper output
- [x] Test with different dates (month boundaries)
- **Verification**: ✅ Same or better draw discovery than scraper (follow-up commits 97af632, 4d6c572 fixed edge cases)

### Task 2.2: Monitor production
- [x] Deploy change
- [x] Monitor Bugsnag for new errors
- [x] Verify reduction in scraper-related issues
- **Verification**: ✅ No new Topptipset errors in production (deployed to develop, PR #141 merged)

## Phase 3: Cleanup (Optional)

### Task 3.1: Deprecate scraper code
- [ ] Add deprecation comment to `topptipset-draw-numbers.ts`
- [ ] Remove AI Scraper URL from runtime config if no longer needed
- [ ] Update documentation
- **Verification**: Deferred - scraper code kept for potential future use as noted in proposal

## Dependencies

- Task 1.2 depends on Task 1.1
- Task 1.3 depends on Task 1.1
- Phase 2 depends on all Phase 1 tasks
- Phase 3 is optional and can be done later

## Parallelizable Work

- Task 1.2 and 1.3 can be done in parallel after Task 1.1 scaffolding
