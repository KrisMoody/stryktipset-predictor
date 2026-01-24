# Change: Surface Unused Prediction Data and Fix Rest Days

## Why

Analysis revealed valuable data that is calculated and stored but not visible in the UI, and a bug where rest days can show unrealistic values (1000+ days) when teams haven't played recently in the system. This data is valuable for user decision-making and is already being sent to AI predictions, but users cannot see it.

## What Changes

### Bug Fix
- **Rest days cap**: Add maximum limit of 90 days (reasonable preseason break). Values above this indicate no recent data and should be treated as `null` (unknown) rather than displayed

### UI Enhancements
- Display **Svenska Folket** (public betting distribution) as stacked bar with numbers
- Display **Tio Tidningars Tips** (expert consensus) in match cards
- Display **Rest Days** with fatigue warnings in match details (hide when null)
- Display **Expected Goals** (Dixon-Coles λ) in statistical model section
- Display **Bookmaker Margin** percentage
- Display **Team Elo Ratings** in match context (not just admin)
- Display **Regression Flags** (overperforming/underperforming xG warnings)
- Display **xG Trend** (last 5 games xG difference)

## Impact

- Affected specs: `statistical-calculations`, `ui-design`
- Affected code:
  - `server/services/statistical-calculations/index.ts` - rest days calculation
  - `components/match/MatchCard.vue` - add missing data display
  - `components/match/PredictionPanel.vue` - add model details
  - `components/match/DataTabs.vue` - enhance statistics tab
