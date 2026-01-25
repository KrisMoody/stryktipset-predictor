## 1. Backend Service Layer
- [x] 1.1 Add `Prisma` import to `failed-games-service.ts`
- [x] 1.2 Add `updateStatusSafe()` method that returns boolean instead of throwing on P2025
- [x] 1.3 Add `markResolvedSafe()` method that returns boolean instead of throwing on P2025

## 2. Backend API Endpoint
- [x] 2.1 Change "record not found" case to return `success: true, alreadyResolved: true`
- [x] 2.2 Add early check for existing match before attempting retry
- [x] 2.3 Use `updateStatusSafe()` with fallback logic when record deleted mid-operation
- [x] 2.4 Replace `markResolved()` calls with `markResolvedSafe()`

## 3. Frontend - Toast Notifications
- [x] 3.1 Add `useToast()` to admin.vue
- [x] 3.2 Update `retryFailedGame()` to handle `alreadyResolved` response
- [x] 3.3 Show appropriate toast (info for already resolved, success for fresh retry, error for failure)

## 4. Frontend - Auto-refresh
- [x] 4.1 Add `useIntervalFn` from VueUse for periodic refresh
- [x] 4.2 Auto-refresh failed games list every 30 seconds
- [x] 4.3 Pause auto-refresh when retry is in progress
- [x] 4.4 Use `useDocumentVisibility` to pause when tab is hidden

## 5. Frontend - Staleness Indicator
- [x] 5.1 Track `lastUpdatedAt` timestamp for failed games data
- [x] 5.2 Display "Updated X seconds ago" in the Failed Games card header
- [x] 5.3 Update timestamp on each refresh

## 6. Validation
- [ ] 6.1 Test retry on a game that was already processed by background sync
- [ ] 6.2 Test normal retry flow still works
- [ ] 6.3 Verify list refreshes correctly after retry
- [ ] 6.4 Verify auto-refresh updates data every 30s
- [ ] 6.5 Verify staleness indicator shows correct time
