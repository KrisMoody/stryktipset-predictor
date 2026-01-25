# Change: Surface System Performance Data

## Why

The system tracks detailed performance data for R/U betting systems but the UI only shows aggregate ROI and average scores. Users lack visibility into:
1. **Score Distribution** - How often each system hits 10/11/12/13 rätt
2. **Winning Row** - The actual correct combination for completed draws
3. **System Guarantee** - What minimum rätt each system guarantees (when all selections are correct)

This data helps users make informed system selection decisions.

## What Changes

### UI Enhancements
- Display **Score Distribution** as histogram/bar chart per system (10/11/12/13 rätt counts)
- Display **Winning Row** for completed draws (the correct 13-game combination)
- Display **System Guarantee** in system selector (e.g., "Guarantees 12 rätt")
- Display **13 Rätt Chance** percentage for each system
- Add **Historical Results** view for completed draws showing correct row vs generated coupons

## Impact

- Affected specs: `ui-design`
- Affected code:
  - `pages/performance.vue` - enhance performance dashboard
  - `components/optimize/SystemSelector.vue` - add guarantee info
  - `components/optimize/OptimizePerformanceDashboard.vue` - add score distribution
  - New component for completed draw analysis
