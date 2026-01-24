# Tasks: Add Fetch Data Buttons to V2 UI

## Task List

### Phase 1: Per-Match Fetch Data Button

- [x] 1. **Add fetch event and props to V2MatchCard component**
   - Add `fetching` prop to track loading state
   - Add `canFetch` prop for action permission
   - Add `fetch` emit event
   - File: `components/v2/MatchCard.vue`

- [x] 2. **Add Fetch Data button to V2MatchCard header**
   - Position next to Predict button
   - Use download icon (`i-heroicons-arrow-down-tray`)
   - Bind to fetching/canFetch props
   - Emit fetch event on click
   - File: `components/v2/MatchCard.vue`

- [x] 3. **Implement fetchMatch handler in V2 draw page**
   - Add `fetching` ref to track per-match fetch state
   - Implement `fetchMatchData(matchId)` function
   - Call `/api/matches/{id}/scrape` endpoint
   - Show toast notifications
   - Refresh draw data on completion
   - File: `pages/v2/draw/[id]/index.vue`

- [x] 4. **Wire up V2MatchCard fetch event**
   - Pass `fetching` and `canFetch` props
   - Handle `@fetch` event
   - File: `pages/v2/draw/[id]/index.vue`

### Phase 2: Draw-Level Fetch All Button

- [x] 5. **Add Fetch All Data button to draw header**
   - Position next to Re-evaluate All button
   - Use download icon
   - Show loading state
   - File: `pages/v2/draw/[id]/index.vue`

- [x] 6. **Implement fetchAllData function**
   - Add `fetchingAll` ref for loading state
   - Iterate through all matches
   - Call scrape endpoint for each
   - Track success/failure counts
   - Show summary toast
   - Refresh draw data
   - File: `pages/v2/draw/[id]/index.vue`

### Phase 3: Dashboard Quick Action

- [x] 7. **Add fetch event to V2DrawCard component**
   - Add `fetchingData` prop
   - Add `canFetch` prop
   - Add `fetchData` emit event
   - File: `components/v2/DrawCard.vue`

- [x] 8. **Add Fetch Data button to V2DrawCard footer**
   - Position after View Matches button
   - Use download icon with "Fetch Data" label
   - Bind to fetchingData/canFetch props
   - File: `components/v2/DrawCard.vue`

- [x] 9. **Implement fetchDrawData handler in V2 dashboard**
   - Add `fetchingData` ref keyed by draw_number
   - Implement `fetchDrawData(drawNumber)` function
   - Fetch data for all matches in draw
   - Show progress/completion toasts
   - Refresh draws list
   - File: `pages/v2/index.vue`

### Phase 4: Validation

- [x] 10. **Manual testing**
    - Test per-match fetch button on draw detail page
    - Test fetch all button on draw detail page
    - Test fetch data button on dashboard draw cards
    - Verify loading states
    - Verify toast notifications
    - Test outside betting window behavior
    - Test admin override functionality

## Dependencies

- Tasks 1-4 can be done in parallel with tasks 7-9
- Task 5-6 depends on task 3 (reuses similar patterns)
- Task 10 depends on all implementation tasks

## Notes

- No changes to existing API endpoints required
- Follows existing V2 UI patterns for consistency
- Uses same data types array as V1: `['xStats', 'statistics', 'headToHead', 'news', 'lineup']`
