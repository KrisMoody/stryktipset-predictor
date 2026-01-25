# Design: Historic Draw Results Page

## Problem Analysis

### Current State
The draw detail page (`/draw/[id]/index.vue`) is designed for **active draws**:
- Actions: Predict, Fetch Data, Re-evaluate, Optimize
- Schedule status awareness with betting window checks
- Mutable predictions workflow

For **historic/archived draws**, users need:
- Match results and scores
- Correct row (winning combination)
- System performance analysis (best scores, ROI)
- Generated coupon review
- Read-only retrospective view

### Data Availability
The existing `/api/draws/[drawNumber]/results` endpoint already returns:
```typescript
{
  drawNumber, correctRow, isComplete,
  matches: [{ matchNumber, homeTeam, awayTeam, outcome, homeScore, awayScore }],
  payoutInfo: { '13': amount, '12': amount, '11': amount, '10': amount },
  systemResults: [{
    systemId, systemType, correctRow, bestScore, winningRows,
    scoreDistribution, payout, roi, cost, rows, analyzedAt
  }]
}
```

## Architectural Decision: Separate Page

### Option Considered: Extend Current Page
- Add `v-if="draw.is_current"` conditionals throughout
- Single page handles both modes

**Rejected because:**
- Violates single responsibility principle
- Complex conditional rendering
- Different user intents (action vs. analysis)
- Harder to maintain and test

### Chosen: Dedicated Results Page
- `/draw/[id]/results.vue` for completed draws
- `/draw/[id]/index.vue` remains action-focused
- Clear separation of concerns
- Purpose-built UI for each use case

## Page Structure

### Results Page Sections

1. **Header**
   - Draw number, game type, date
   - "Completed" status badge
   - Correct row display (e.g., "1X21X2X1X21X2")

2. **Match Results Table**
   - Match number, teams, scores, outcome
   - Visual outcome indicators (1/X/2 badges)
   - Compact tabular layout

3. **Performance Summary Cards**
   - Best system performance
   - Total rows played
   - Best score achieved
   - Total payout / Total cost = ROI

4. **System Performance Breakdown**
   - Per-system cards showing:
     - System ID and type (R/U/T)
     - Score distribution chart
     - Winning rows count
     - ROI calculation
     - Expandable row details

5. **Payout Information**
   - Prize tier breakdown (13, 12, 11, 10 correct)
   - Visualization of prize pool

## Navigation Flow

```
Admin Page
├── Current Draws → Click → /draw/{number}?gameType=xxx (work page)
└── Archived Draws → Click → /draw/{number}/results?gameType=xxx (results page)
```

The admin page determines destination based on `is_current` flag.

## API Changes

### `current.get.ts` - Add Missing Fields
```diff
select: {
+ id: true,
+ game_type: true,
  draw_number: true,
  draw_date: true,
  close_time: true,
  status: true,
  is_current: true,
  matches: { ... }
}
```

### Navigation Logic
```typescript
function navigateToDraw(draw: DrawInfo) {
  const path = draw.is_current
    ? `/draw/${draw.draw_number}`
    : `/draw/${draw.draw_number}/results`
  navigateTo({ path, query: { gameType: draw.game_type } })
}
```

## Error Handling

Both pages should handle missing draws gracefully:
```vue
<div v-if="pending">Loading...</div>
<template v-else-if="data">...</template>
<div v-else>
  <UAlert color="error" title="Draw Not Found">
    Unable to load draw data.
  </UAlert>
</div>
```
