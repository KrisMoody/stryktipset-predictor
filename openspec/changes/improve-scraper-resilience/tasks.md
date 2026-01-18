# Tasks: Improve Scraper Resilience

## Phase 1: Replace Scraper with Datepicker API

### Task 1.1: Update fetchTopptipsetCurrentDraws()
- [ ] Modify `server/services/svenska-spel-api.ts`
- [ ] Remove scraper import and call
- [ ] Call `fetchAvailableDraws()` for current month
- [ ] Call `fetchAvailableDraws()` for next month (handle year boundary)
- [ ] Filter results for `drawState === "Open"`
- [ ] Fetch each open draw via `fetchDrawWithMultifetch()`
- **Verification**: Topptipset draws sync without scraper

### Task 1.2: Handle month/year boundaries
- [ ] Calculate current and next month correctly (Dec → Jan)
- [ ] Handle year rollover in next month calculation
- [ ] Deduplicate draw numbers from both month queries
- **Verification**: Draws at month boundaries are discovered

### Task 1.3: Add logging for new flow
- [ ] Log datepicker API calls
- [ ] Log number of open draws found
- [ ] Log any errors from datepicker API
- **Verification**: Logs show clear flow through new code path

## Phase 2: Testing

### Task 2.1: Manual verification
- [ ] Run sync and verify Topptipset draws are discovered
- [ ] Compare results with current scraper output
- [ ] Test with different dates (month boundaries)
- **Verification**: Same or better draw discovery than scraper

### Task 2.2: Monitor production
- [ ] Deploy change
- [ ] Monitor Bugsnag for new errors
- [ ] Verify reduction in scraper-related issues
- **Verification**: No new Topptipset errors in production

## Phase 3: Cleanup (Optional)

### Task 3.1: Deprecate scraper code
- [ ] Add deprecation comment to `topptipset-draw-numbers.ts`
- [ ] Remove AI Scraper URL from runtime config if no longer needed
- [ ] Update documentation
- **Verification**: Code clearly marked as deprecated

## Dependencies

- Task 1.2 depends on Task 1.1
- Task 1.3 depends on Task 1.1
- Phase 2 depends on all Phase 1 tasks
- Phase 3 is optional and can be done later

## Parallelizable Work

- Task 1.2 and 1.3 can be done in parallel after Task 1.1 scaffolding
