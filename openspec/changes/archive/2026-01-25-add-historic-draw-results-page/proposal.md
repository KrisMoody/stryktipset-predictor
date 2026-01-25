# Change: Add Historic Draw Results Page

## Why
When users click on archived draws from the admin page, they land on a blank page because:
1. The current draw page is action-oriented (predict, fetch, optimize) - inappropriate for completed draws
2. The `/api/admin/draws/current` endpoint doesn't return `id` or `game_type` fields needed for navigation
3. There's no dedicated UI for reviewing draw results, system performance, and ROI analysis

Historic draws have fundamentally different data and user intent than active draws - users want to review results and analyze performance, not take actions.

## What Changes
1. **New page**: `/draw/[id]/results` - dedicated results analysis page for completed draws
2. **API fix**: Add `id` and `game_type` to admin draws endpoints
3. **Smart routing**: Admin page navigates archived draws to results page, current draws to work page
4. **Error handling**: Add fallback UI when draw data fails to load

## Impact
- Affected specs: ui-design
- New files: `pages/draw/[id]/results.vue`
- Modified files:
  - `server/api/admin/draws/current.get.ts`
  - `pages/admin.vue`
  - `pages/draw/[id]/index.vue`

## Dependencies
- Leverages existing `/api/draws/[drawNumber]/results` endpoint which already returns performance data
- Reuses existing `system_performance` and `generated_coupons` database tables
