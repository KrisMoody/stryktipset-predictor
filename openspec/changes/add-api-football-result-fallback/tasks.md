## 1. API-Football Result Fetching
- [x] 1.1 Add `fetchFixtureResult(fixtureId)` method to match-enrichment service
- [x] 1.2 Add helper to extract result from API-Football fixture response
- [x] 1.3 Handle different match statuses (FT, AET, PEN, PST, CANC, ABD)
- [x] 1.4 Add `result_source` field to matches table to track where result came from

## 2. Automatic Result Sync Service
- [x] 2.1 Create `result-fallback-service.ts` with core logic
- [x] 2.2 Implement `findDrawsNeedingResultSync()` - finds draws past 48h threshold
- [x] 2.3 Implement `syncDrawResults(drawId)` - fetches missing results for a draw
- [x] 2.4 Implement `syncMatchResult(matchId)` - fetches result for single match
- [x] 2.5 Add result validation logic (compare with Svenska Spel if both exist)

## 3. Scheduled Job
- [x] 3.1 Add scheduled job to run result sync every 6 hours
- [x] 3.2 Add logging for sync operations (matches updated, skipped, errors)
- [x] 3.3 Integrate with draw lifecycle - archive draws that become complete

## 4. Admin API Endpoints
- [x] 4.1 `GET /api/admin/draws/[id]/result-status` - shows missing results and API-Football availability
- [x] 4.2 `POST /api/admin/draws/[id]/fetch-results` - triggers result fetch from API-Football
- [x] 4.3 `POST /api/admin/draws/[id]/commit-results` - commits fetched results after review
- [x] 4.4 Update failed-games retry to use API-Football as fallback source

## 5. Admin UI Updates
- [x] 5.1 Add "Fetch Results" button to pending finalization view
- [x] 5.2 Add result preview modal showing fetched results before commit
- [x] 5.3 Add discrepancy warnings when sources disagree
- [ ] 5.4 Add result source indicator on match rows (deferred - not blocking)

## 6. Testing
- [x] 6.1 Unit tests for result extraction from API-Football response
- [x] 6.2 Unit tests for 48h threshold logic
- [ ] 6.3 Integration test for full sync flow (deferred - requires test database)
- [x] 6.4 Test handling of special statuses (PST, CANC, ABD)
