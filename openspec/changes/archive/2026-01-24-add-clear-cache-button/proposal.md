# Proposal: Add Clear Cache Button

## Summary

Add a "Clear Cache" button to the Admin Control Panel in both V1 and V2 UI versions. This button will allow administrators to manually flush the server-side in-memory cache when needed to resolve stale data issues.

## Problem Statement

Currently, cache invalidation happens automatically through:
- Sync operations (via `drawCacheService.invalidateCurrentDrawsCache()`)
- Draw finalization (via `drawCacheService.invalidateAllDrawCache()`)
- TTL expiration (based on betting window phase)

However, there are situations where administrators need to manually clear the cache:
- Debugging stale data issues
- After manual database changes
- When cache behaves unexpectedly
- To force fresh data fetching without waiting for TTL

Currently this requires server restart or direct code intervention.

## Proposed Solution

Add a simple "Clear Cache" action card to the Admin Control Panel that:
1. Calls a new API endpoint `POST /api/admin/cache/clear`
2. Clears both the main cache (`cacheService.flush()`) and draw cache (`drawCacheService.invalidateAllDrawCache()`)
3. Returns cache statistics before and after clearing
4. Shows success/failure feedback to the user

## Scope

### In Scope
- New API endpoint for cache clearing
- UI button in Admin panel (V1 and V2)
- Cache statistics display
- Loading state and result feedback

### Out of Scope
- Selective cache clearing (pattern-based)
- Cache analytics/history
- Automatic cache clearing rules

## User Impact

- **Admins**: Can quickly resolve stale data issues without technical intervention
- **Users**: No direct impact (admin-only feature)

## Technical Approach

1. **API Endpoint**: Create `POST /api/admin/cache/clear` that:
   - Requires admin authentication
   - Calls `cacheService.flush()` and `drawCacheService.invalidateAllDrawCache()`
   - Returns before/after stats

2. **UI Component**: Add to "Actions" section in both admin pages:
   - "Clear Cache" card with button
   - Shows current cache stats (keys count)
   - Displays success/error feedback
   - Confirmation not required (safe, reversible operation)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Cache thrashing from repeated clears | Low risk - admin-only, adds small latency spike |
| Accidental clearing | Action is safe and reversible (cache repopulates on next request) |

## Success Criteria

- Admin can clear cache with single button click
- Cache statistics visible before clearing
- Operation completes successfully with feedback
- Feature works in both V1 and V2 admin pages
