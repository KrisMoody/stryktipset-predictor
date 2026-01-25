## 1. Backend - Time-Series API

- [x] 1.1 Create `/api/performance/progression` endpoint
- [x] 1.2 Implement weekly aggregation query (accuracy, Brier score, sample count per week)
- [x] 1.3 Add 30-day rolling average calculation
- [x] 1.4 Add optional game_type filter parameter
- [x] 1.5 Add tests for progression endpoint (typecheck and lint validation)

## 2. Frontend - Progression Charts

- [x] 2.1 Add progression section to analytics.vue
- [x] 2.2 Implement line chart for weekly accuracy trend
- [x] 2.3 Add Brier score trend visualization (via probability score tracking)
- [x] 2.4 Add period comparison stats (current vs previous period)
- [x] 2.5 Add game type filter dropdown

## 3. Testing & Validation

- [x] 3.1 Verify typecheck passes
- [x] 3.2 Verify eslint passes
- [x] 3.3 Test empty state handling (insufficient data message)
