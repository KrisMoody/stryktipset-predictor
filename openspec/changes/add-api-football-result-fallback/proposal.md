# Change: Add API-Football as Fallback for Match Results

## Why
Some matches fail to finalize because Svenska Spel API doesn't provide results in a timely manner. Draws can get stuck with missing results, preventing proper archiving and performance tracking. Currently this requires manual intervention to resolve.

The system already has API-Football integration for pre-match data enrichment, including fixture ID mappings. We can leverage this to automatically fetch missing results and finalize draws after a reasonable waiting period.

## What Changes

### Automatic Result Sync (48h after last match)
- A scheduled job checks for draws where 48 hours have passed since the last match started
- For matches missing results, fetch from API-Football using existing fixture ID mappings
- Validate results and update matches
- Archive draws that become complete

### Manual Result Lookup (Admin Triggered)
- Admin can manually trigger result lookup for any draw at any time
- Preview shows which matches are missing results and what will be fetched
- Admin can review fetched results before committing
- Admin can then finalize/archive the draw

### Result Validation
- When both Svenska Spel and API-Football have results, compare them
- Log discrepancies for audit (Svenska Spel remains authoritative)
- Surface warnings in admin UI if discrepancies exist

## Impact
- Affected specs: `api-football-integration`
- Affected code:
  - `server/services/api-football/` - New result fetching method
  - `server/services/draw-lifecycle.ts` - Integration with result fallback
  - `server/services/failed-games-service.ts` - Use API-Football for result-related failures
  - `server/plugins/scheduler.ts` - New scheduled job (runs every 6 hours, checks 48h threshold)
  - `server/api/admin/` - New endpoints for manual result lookup
