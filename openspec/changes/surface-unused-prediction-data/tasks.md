## 1. Fix Rest Days Calculation

- [x] 1.1 Add `MAX_REST_DAYS` constant (90 days) to `types.ts`
- [x] 1.2 Update `calculateRestDays()` in `index.ts` to return `null` if days > MAX_REST_DAYS
- [x] 1.3 Update prediction service to handle null rest days gracefully (already does)
- [ ] 1.4 Backfill existing `match_calculations` with corrected rest days values

## 2. Surface Svenska Folket & Tio Tidningars Tips

- [x] 2.1 Create `ExpertConsensus.vue` component showing 10 Tidningars Tips
- [x] 2.2 Create `PublicBetting.vue` component showing Svenska Folket distribution
- [x] 2.3 Add both components to `MatchCard.vue` odds section
- [x] 2.4 Style with appropriate visual indicators (bar charts or pill badges)

## 3. Surface Statistical Model Data

- [x] 3.1 Add "Model Analysis" section to `PredictionPanel.vue` or `DataTabs.vue`
- [x] 3.2 Display Expected Goals (λ) for each team
- [x] 3.3 Display Bookmaker Margin percentage
- [x] 3.4 Display Team Elo ratings with confidence level
- [x] 3.5 Display Rest Days with fatigue warning icon when < 3 days (hide when null)
- [x] 3.6 Display Regression Flags (overperforming/underperforming xG) with warning styling
- [x] 3.7 Display xG Trend (last 5 games) with positive/negative indicator

## 4. Testing & Validation

- [x] 4.1 Verify rest days cap works for edge cases (new teams, season breaks)
- [x] 4.2 Verify UI displays correctly when data is missing (graceful fallback)
- [x] 4.3 Manual testing on draws with varied data quality
