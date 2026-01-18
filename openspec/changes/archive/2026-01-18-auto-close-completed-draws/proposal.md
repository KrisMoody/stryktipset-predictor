# auto-close-completed-draws

## Summary
Automatically set draws to "Completed" status and archive them when all matches have final results, rather than waiting for Svenska Spel API to update the status.

## Problem Statement
Draws stay open much longer than they should. Most draws never get closed automatically because the system waits for the Svenska Spel API to change the draw status to "Completed". However:

1. **API delay**: Svenska Spel may take hours or days to update the draw status after matches finish
2. **API unreliability**: Some draws never get their status updated by the API (stays at "Closed")
3. **Missed finalization**: The 4 AM daily job only archives draws with `status === "Completed"`, so draws without this API status remain "current" indefinitely

The result is a growing backlog of "current" draws that clutter the UI and make it hard to see which draws are genuinely active.

## Status vs Archive Clarification

**Draw `status` field** (from Svenska Spel API):
- `"Open"` - Betting window active, users can place bets
- `"Closed"` - Betting has stopped (spelstopp), matches in progress
- `"Completed"` - All matches finished (API updated - often delayed/missing)

**Draw `is_current` field** (internal archiving):
- `true` - Draw appears in UI, uses "current" scraping URLs
- `false` - Draw archived, hidden from main UI but data preserved for stats/analysis

**Archiving does NOT delete data** - it simply removes the draw from the active draws list. All match data, predictions, and statistics remain fully accessible.

## Proposed Solution
Detect draw completion internally by checking if all matches have final results (`result_home`, `result_away`, and `outcome` are set), rather than relying on the external API status field.

### Key Changes

1. **Set status to "Completed" internally** - When all matches have results, update `draw.status = "Completed"` ourselves
2. **Archive completed draws** - Also set `is_current = false` to remove from active draws list
3. **Real-time detection** - Check completion when match results are synced, not just at 4 AM
4. **Remove API status dependency** - `shouldArchive()` checks match results, not `draw.status`

## Impact Analysis

### What Changes
- `server/services/draw-lifecycle.ts` - Updated `shouldArchive()` criteria
- `server/services/draw-sync.ts` - Add completion check after match result sync
- Draw finalization happens immediately after last match result, not just at 4 AM

### What Stays the Same
- Admin manual archive functionality
- Existing scheduled jobs (just more effective now)
- All draw data remains accessible for stats and analysis
- Cache invalidation behavior

## Success Criteria
- Draws are set to "Completed" and archived within minutes of the last match finishing
- Zero draws remain "current" when all their matches have results
- No impact on statistics or historical data analysis
