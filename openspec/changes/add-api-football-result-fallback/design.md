## Context

The system currently relies on Svenska Spel API for match results. When results are missing or delayed, draws cannot be properly finalized. The existing API-Football integration already:
- Maps teams and leagues to API-Football IDs
- Stores `api_football_fixture_id` on matches
- Has a client with rate limiting, caching, and circuit breaker

This change adds result fetching as a fallback mechanism, both automatic (48h after last match) and manual (admin triggered).

## Goals / Non-Goals

**Goals:**
- Automatically finalize draws 48h after the last match starts (if results available)
- Allow admins to manually trigger result lookup at any time
- Validate results between sources when both are available
- Reduce manual intervention for failed game resolution

**Non-Goals:**
- Replace Svenska Spel as the primary result source
- Live match tracking during games
- Aggressive polling for results (keep it simple and quota-friendly)

## Key Decisions

### 1. Timing: 48 hours after last match start

**Rationale:**
- Draws typically span 1-2 days with matches at different times
- 48h after the LAST match starts guarantees all matches should be finished
- Conservative buffer for postponements, rescheduled games, API delays
- Not per-match (3h) because that's unnecessarily aggressive and complicates logic

**Implementation:**
```sql
-- Find draws ready for automatic result sync
SELECT d.* FROM draws d
WHERE d.is_current = true
  AND (SELECT MAX(m.start_time) FROM matches m WHERE m.draw_id = d.id) < NOW() - INTERVAL '48 hours'
  AND EXISTS (
    SELECT 1 FROM matches m
    WHERE m.draw_id = d.id
    AND m.outcome IS NULL
  )
```

### 2. Lookup Strategy: Use existing fixture ID

The `api_football_fixture_id` is already stored on matches by the enrichment service. For result fetching:

1. If `api_football_fixture_id` exists: Direct lookup via `GET /fixtures?id={id}`
2. If not: Run enrichment first to find fixture ID, then fetch result
3. If still not found: Log warning, skip (admin can manually resolve)

### 3. Manual vs Automatic Flow

**Automatic (scheduled, every 6 hours):**
- Finds draws past 48h threshold with missing results
- Fetches results silently, logs actions
- Archives draws that become complete
- No human intervention required

**Manual (admin triggered):**
- Admin selects a draw from pending finalization list
- System shows preview: missing matches, API-Football availability
- Admin clicks "Fetch Results from API-Football"
- System fetches and shows results before committing
- Admin reviews, can override if needed
- Admin finalizes/archives the draw

### 4. Handling Special Match States

| API-Football Status | Action |
|---------------------|--------|
| FT (Full Time) | Update result normally |
| AET (After Extra Time) | Update result (90-min score from `score.fulltime`) |
| PEN (After Penalties) | Update result (90-min score from `score.fulltime`) |
| PST (Postponed) | Mark match as postponed, no result expected |
| CANC (Cancelled) | Mark match as cancelled, no result expected |
| ABD (Abandoned) | Mark match status, may have partial result |
| NS/1H/2H/HT/ET | Match not finished, skip and retry later |

### 5. Result Validation

When Svenska Spel provides a result later (or already has one):
- Compare with API-Football result
- If they match: Good, log success
- If they differ: Log warning, keep Svenska Spel result (authoritative)
- Show discrepancies in admin UI for awareness

## Data Flow

```
[Scheduler: Every 6 hours]
        |
        v
[Find eligible draws]
  - is_current = true
  - last match start > 48h ago
  - has matches with missing results
        |
        v
[For each eligible draw]
        |
        v
[For each match missing result]
        |
        +-- Has api_football_fixture_id?
        |       |
        |       +-- Yes --> Fetch /fixtures?id={id}
        |       |
        |       +-- No --> Run enrichMatch() first
        |                       |
        |                       +-- Found fixture? --> Fetch result
        |                       |
        |                       +-- Not found --> Log, skip
        |
        v
[Process API-Football response]
        |
        +-- Status FT/AET/PEN --> Update match result
        |
        +-- Status PST/CANC/ABD --> Update match status (no result)
        |
        +-- Status NS/1H/2H/etc --> Skip (not finished)
        |
        v
[After processing all matches]
        |
        v
[Check draw completion]
        |
        +-- All matches have results or terminal status --> Archive draw
        |
        +-- Still missing --> Leave for next cycle
```

## Manual Admin Flow

```
[Admin: Views pending finalization]
        |
        v
[Clicks "Fetch Results" on a draw]
        |
        v
[System shows preview]
  - N matches missing results
  - M matches have API-Football fixture ID
  - K matches need enrichment first
        |
        v
[Admin confirms fetch]
        |
        v
[System fetches results]
  - Shows results before committing
  - Highlights any discrepancies with Svenska Spel
        |
        v
[Admin reviews and confirms]
        |
        v
[System commits results]
        |
        v
[Admin can now finalize/archive draw]
```

## API Quota Considerations

- Free tier: 100 requests/day
- Pro tier: 7,500 requests/day
- Each match result fetch = 1 request (by fixture ID, very efficient)
- Typical draw = 13 matches max
- Running every 6h means at most 4 checks per day
- Worst case per day: ~50-60 requests for result fetching

This leaves plenty of quota for pre-match enrichment (statistics, predictions, etc.)

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| API-Football doesn't have result | Can't auto-finalize | Admin can manually enter, or wait longer |
| Result discrepancy | Confusion about correct score | Log clearly, show in UI, trust Svenska Spel |
| Team not mapped | Can't look up fixture | Enrichment will try to map, admin fallback |
| Match postponed after draw created | Stuck waiting for result | Handle PST/CANC/ABD status appropriately |
| API quota exhausted | No result fetching that day | Graceful degradation, try next day |

## Open Questions

1. **Should postponed/cancelled matches block draw finalization?**
   Recommendation: No - mark them with special status and allow finalization. Admin can decide if they want to wait for rescheduled match.

2. **How long to retry before giving up?**
   Recommendation: No hard limit. Keep checking every 6h until admin manually intervenes or results appear. Log after 7 days for visibility.
