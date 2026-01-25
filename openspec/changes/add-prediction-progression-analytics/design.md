## Context

The analytics page shows aggregate prediction performance but lacks time-series views. Users want to know if system changes are improving predictions. The existing data model already stores timestamps on predictions and performance records, so this feature requires no schema changes.

## Goals / Non-Goals

**Goals:**
- Visualize prediction accuracy progression over time
- Enable comparison between time periods
- Track model calibration improvements via Brier score trends
- Keep implementation simple using existing chart libraries (NuxtUI/Vue ecosystem)

**Non-Goals:**
- Real-time streaming metrics (batch aggregation is sufficient)
- A/B testing framework (out of scope - just show historical trends)
- Complex statistical analysis beyond accuracy/Brier score
- Automated alerts when metrics degrade

## Decisions

### Time Aggregation
- **Decision**: Aggregate by week for the progression chart
- **Rationale**: Weekly provides enough granularity to spot trends without too much noise. Daily would be too noisy with few predictions per day. Monthly would be too coarse to detect recent changes.

### Chart Library
- **Decision**: Use VChart (bundled with Nuxt UI) or lightweight alternatives like Chart.js
- **Rationale**: Keep dependencies minimal. NuxtUI already includes charting capabilities. Avoid adding heavy visualization libraries.

### Data Fetching
- **Decision**: Single API endpoint returning aggregated time-series data
- **Rationale**: Server-side aggregation is more efficient than fetching raw records. SQL window functions can compute rolling averages efficiently.

### Rolling Windows
- **Decision**: Show 30-day rolling accuracy on the same chart as historical weekly points
- **Rationale**: Rolling window smooths out variance and makes trends more visible. 30 days provides a good balance.

## Risks / Trade-offs

- **Performance risk with large datasets**: Mitigated by aggregating on server side with indexed queries. The `prediction_performance.created_at` column is already indexed.
- **Chart complexity**: Keep to one or two simple line charts initially. Can add more visualizations later based on user feedback.

## Open Questions

1. Should we show model version annotations on the timeline? (marks when model/data changes occurred) - Could be useful but requires tracking version change events.
2. Filter by game type (Stryktipset vs Europatipset)? - Probably yes, as different game types may have different accuracy profiles.
