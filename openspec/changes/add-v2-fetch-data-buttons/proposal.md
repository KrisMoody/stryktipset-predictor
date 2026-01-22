# Proposal: Add Fetch Data Buttons to V2 UI

## Summary

Add "Fetch Data" functionality to the V2 UI that is currently missing compared to V1. This includes:
1. A per-match "Fetch Data" button on the V2 MatchCard component
2. A "Fetch All Data" button at the draw level for batch fetching

## Problem Statement

The V1 UI has a "Fetch Data" button on each match card ([pages/draw/[id]/index.vue:187-190](pages/draw/[id]/index.vue#L187-L190)) that triggers scraping for match statistics (xStats, statistics, headToHead, news, lineup). This functionality is completely missing from the V2 UI.

Without this feature, users of the V2 interface cannot:
- Manually trigger data fetching for individual matches
- Fetch data for all matches in a draw at once
- Refresh stale data before generating predictions

## Proposed Solution

### 1. Per-Match Fetch Data Button (V2MatchCard)

Add a "Fetch Data" button to the V2MatchCard component header actions, similar to the existing "Predict" and "Re-evaluate" buttons.

**Location**: [components/v2/MatchCard.vue:22-46](components/v2/MatchCard.vue#L22-L46)

**Behavior**:
- Shows loading state while fetching
- Disabled when outside betting window (unless admin override)
- Calls `/api/matches/{id}/scrape` endpoint
- Shows toast notification on success/failure
- Refreshes match data after completion

### 2. Draw-Level Fetch All Data Button

Add a "Fetch All Data" button to the V2 draw detail page header, next to the existing "Re-evaluate All" button.

**Location**: [pages/v2/draw/[id]/index.vue:32-51](pages/v2/draw/[id]/index.vue#L32-L51)

**Behavior**:
- Fetches data for all matches in the draw sequentially or in parallel
- Shows progress indicator
- Respects schedule window / admin override
- Shows summary toast on completion

### 3. Draw Dashboard Quick Action

Add a "Fetch Data" button to the V2DrawCard component on the dashboard, allowing users to trigger data fetch for an entire draw without navigating to the detail page.

**Location**: [components/v2/DrawCard.vue:47-75](components/v2/DrawCard.vue#L47-L75)

## UI/UX Considerations

- Button placement follows existing patterns (header actions area)
- Loading states provide visual feedback
- Disabled state when outside betting window
- Toast notifications for success/failure feedback
- Icon: `i-heroicons-arrow-down-tray` (download icon) to differentiate from sync/refresh

## Out of Scope

- Changes to the scraping API endpoints (already functional)
- Changes to the data storage or processing logic
- V1 UI modifications

## Dependencies

- Existing `/api/matches/{id}/scrape` endpoint
- Existing scraping infrastructure ([server/services/scraper/](server/services/scraper/))
- V2 UI components already in place
