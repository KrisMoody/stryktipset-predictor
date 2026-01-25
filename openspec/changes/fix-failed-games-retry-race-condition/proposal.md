# Change: Fix Failed Games Retry Race Condition

## Why
The admin retry endpoint for failed games returns confusing errors when a background draw sync has already processed the match. Users see "Failed game record not found" or "No record was found for an update" when the actual situation is that the game was already successfully resolved. This happens frequently because the UI displays stale data while background syncs resolve games.

## What Changes
- Return success with `alreadyResolved` flag when retrying an already-processed game
- Add "safe" database update methods that handle P2025 (record not found) errors gracefully
- Add toast notifications in admin UI to inform users of retry outcomes
- Add auto-refresh for failed games list (every 30 seconds when visible)
- Add "last updated" timestamp indicator to show data freshness

## Impact
- Affected specs: `admin-failed-games` (new capability)
- Affected code:
  - `server/services/failed-games-service.ts` - Add safe update methods
  - `server/api/admin/draws/failed-games/[id]/retry.post.ts` - Handle race conditions
  - `pages/admin.vue` - Toast notifications, auto-refresh, staleness indicator
