# Change: Add Prediction Progression Analytics

## Why

The analytics page currently shows aggregate performance metrics but doesn't reveal whether the prediction system is improving, degrading, or staying flat over time. As the app evolves - adding new data sources, adjusting model parameters, feeding different data types to the prediction service - there's no way to see if these changes actually help predictions.

Users need time-series visualizations to:
- Track prediction accuracy trends over weeks/months
- Compare performance across different time periods
- Identify when changes to the system had positive or negative impact
- Make data-driven decisions about future improvements

## What Changes

- Add time-series accuracy chart showing weekly/monthly progression
- Add rolling window comparison (last 30/60/90 days vs historical average)
- Add Brier score trend visualization for model calibration tracking
- Add model version comparison to detect improvements from system changes
- Reuse existing data (predictions, prediction_performance tables already have timestamps)

## Impact

- Affected specs: New capability `analytics-progression`
- Affected code:
  - `pages/analytics.vue` - Add progression section with charts
  - `server/api/performance/` - New endpoint for time-series data
  - No database migrations - existing schema has required timestamps
