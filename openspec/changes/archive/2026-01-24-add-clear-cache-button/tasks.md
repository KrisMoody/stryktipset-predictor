# Tasks: Add Clear Cache Button

## Implementation Tasks

### Backend

- [ ] **1. Create cache clear API endpoint**
  - Create `server/api/admin/cache/clear.post.ts`
  - Call `cacheService.flush()` to clear main cache
  - Call `drawCacheService.invalidateAllDrawCache()` to clear draw caches
  - Return stats (keys before, keys after, timestamp)
  - Require admin authentication

- [ ] **2. Create cache stats API endpoint**
  - Create `server/api/admin/cache/stats.get.ts`
  - Return current cache statistics from `cacheService.getStats()`
  - Include inflight requests count
  - Require admin authentication

### Frontend - V1 UI

- [ ] **3. Add clear cache card to V1 admin page**
  - Add new UCard in "Actions" section of `pages/admin.vue`
  - Display current cache stats (key count)
  - Add "Clear Cache" button with loading state
  - Show success/error feedback after operation

### Frontend - V2 UI

- [ ] **4. Add clear cache card to V2 admin page**
  - Add new UCard in "Actions" section of `pages/v2/admin.vue`
  - Match V1 implementation for consistency
  - Display current cache stats (key count)
  - Add "Clear Cache" button with loading state
  - Show success/error feedback after operation

### Validation

- [ ] **5. Manual testing**
  - Test cache clear in V1 admin
  - Test cache clear in V2 admin
  - Verify cache stats update after clear
  - Verify non-admins cannot access endpoint

## Dependencies

- Tasks 3 and 4 depend on tasks 1 and 2

## Parallel Work

- Tasks 1 and 2 can be done in parallel
- Tasks 3 and 4 can be done in parallel (after 1 and 2)
