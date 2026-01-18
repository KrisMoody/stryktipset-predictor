# Tasks for auto-close-completed-draws

## Implementation Tasks

### 1. Update draw completion detection logic
- [x] Modify `DrawLifecycleService.shouldArchive()` to check only for "all matches have results" condition
- [x] Remove or make optional the `draw.status === "Completed"` requirement
- [x] Add logging to indicate why a draw qualifies for archiving
- **Validation**: Unit test that `shouldArchive()` returns `true` when all matches have results, regardless of `draw.status`

### 2. Add immediate completion check on match sync
- [x] In `DrawSyncService.processMatch()`, after syncing a match with FT status and results, check if the draw is now complete
- [x] If all matches in the draw have results, call `drawLifecycle.archiveDraw()`
- [x] Invalidate draw cache after immediate archival
- **Validation**: Integration test showing draw archives immediately when last match result is synced

### 3. Update draw status internally on completion
- [x] When all matches are complete, set `draw.status = "Completed"` ourselves
- [x] This maintains compatibility with any code that checks the status field
- **Validation**: Verify draw status is updated to "Completed" alongside `is_current = false`

### 4. Add draw completion helper method
- [x] Create `DrawLifecycleService.checkDrawCompletion(drawId)` method
- [x] Returns whether all matches have results
- [x] Used by both sync service and existing archive check
- **Validation**: Unit tests for helper method with various match result states

### 5. Create backfill script for existing draws
- [x] Create `scripts/close-completed-draws.ts` script
- [x] Find all draws where `is_current = true` but all matches have results
- [x] Update each to `status = "Completed"` and `is_current = false`
- [x] Add `--dry-run` flag to preview changes without applying
- [x] Log summary of draws updated
- **Validation**: Run with `--dry-run` first, verify correct draws identified

### 6. Test existing scheduled job still works
- [x] Verify 4 AM `checkAndArchiveCompletedDraws()` job works with new logic
- [x] Ensure it catches any draws missed by real-time detection
- **Validation**: Unit tests pass for the scheduled path

## Dependency Order
- Task 4 (helper method) should be done first
- Tasks 1 and 2 depend on Task 4
- Task 3 depends on Task 1
- Task 5 can run independently (uses same logic as Task 1)
- Task 6 depends on all other tasks
