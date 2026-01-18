# Change Proposal: API-Football Data Integration

**Change ID**: `integrate-api-football-data`
**Status**: 📋 Proposed
**Created**: 2026-01-17
**Author**: AI Assistant (based on user requirements)

---

## Quick Links

- **[Specification](spec.md)** - Interface definitions, data structures, validation rules
- **[Proposal](proposal.md)** - Why we're making this change, value proposition
- **[Tasks](tasks-revised.md)** - Implementation steps and validation criteria
- **[Architecture](ARCHITECTURE.md)** - Loose coupling design and fallback strategy
- **[Optimization Notes](OPTIMIZATION-NOTES.md)** - API efficiency optimizations
- **[Executive Summary](SUMMARY.md)** - High-level overview for stakeholders

---

## Overview

Integrate API-Football as a data provider to replace fragile web scraping with reliable API data, enable automatic team/league matching for all European leagues, and add 3-5 years of historical data for better predictions.

### Problem Statement

**Current Issues:**
- Web scraping breaks frequently when websites change structure
- Manual team mapping required for new leagues
- No historical data beyond current season
- Scraper maintenance consumes 10 hours/month
- Limited to leagues with available web scrapers

**User Requirements:**
1. ✅ Automatic team/league identification for all European leagues
2. ✅ Historical data (3-5 years) for better similarity search
3. ✅ Hybrid approach (keep Svenska Spel scraping for betting tips)
4. ✅ Pre-match data only (no live tracking needed)
5. ✅ Loose coupling (app must work if API-Football shuts down)
6. ✅ Clear data storage strategy

### Solution Summary

**Phase 1** (Weeks 1-2): Automatic team/league matching with confidence scoring
**Phase 2** (Weeks 3-4): Pre-match data enrichment (statistics, injuries, H2H)
**Phase 3** (Weeks 5-7+): Historical data backfill (100K+ matches)
**Phase 4** (Week 8+): Post-match result sync and performance tracking

**Key Innovation:** Provider abstraction layer ensures app continues working with automatic fallback to web scraping if API-Football fails or shuts down.

---

## Business Case

### Costs
- **API Subscription**: $10-30/month (Basic Plan sufficient, Pro for backfill)
- **One-time backfill**: ~$180 over 6 months

### Benefits
- **Scraper maintenance savings**: $500-1,000/month
- **Improved reliability**: Eliminate scraper failures
- **Better predictions**: 3-5 years historical context
- **Automatic scaling**: Support all European leagues without manual work

**Net ROI**: $370-890/month profit after API costs

---

## Implementation Approach

### Architecture Highlights

1. **Provider Abstraction Layer**
   - Prediction service depends only on `MatchDataProvider` interface
   - Multiple implementations: API-Football, Web Scraper, Cache
   - Automatic fallback chain with circuit breaker pattern

2. **Automatic Team Matching**
   - Strategy 1: Direct ID lookup (betRadar_id, kambi_id)
   - Strategy 2: Fuzzy text matching with 80%+ similarity threshold
   - Strategy 3: Manual override table for edge cases
   - Confidence scoring: high (95%+), medium (80-95%), low (<80%)

3. **Loose Coupling**
   - Feature flag: `ENABLE_API_FOOTBALL=true/false`
   - Circuit breaker: Opens after 3 failures, tries again after 5 minutes
   - Emergency rollback: One environment variable change

4. **Source-Agnostic Storage**
   - Database stores data with `source` field
   - App reads from database without caring about origin
   - Seamless migration between data providers

### Database Changes

**New Tables:**
- `team_mappings` - Team ID mappings with confidence scores
- `league_mappings` - League ID mappings
- `api_football_cache` - Response cache with TTL
- `api_football_usage` - API quota tracking
- `historical_matches` - 100K+ historical match data

**Modified Tables:**
- `match_scraped_data` - Add `source`, `fetched_at`, `is_stale` columns
- `matches` - Add `api_football_fixture_id` and mapping confidence

---

## Validation Plan

### Phase 1 Validation (Team Matching)
- Test with 3 recent draws (Stryktipset + Europatipset)
- Target: 95%+ high-confidence matches
- Manual review of low-confidence matches (<5%)
- Verify <100 API calls per draw

### Phase 2 Validation (Data Quality)
- Parallel run API + scraping for 1 week
- Compare data completeness and accuracy
- Spot-check 20 matches manually
- Verify prediction quality maintained/improved

### Phase 3 Validation (Historical Data)
- Backfill completes for top 10 European leagues
- Similarity search returns relevant historical matches
- Historical context appears in prediction reasoning

### Phase 4 Validation (Result Sync)
- 100% match results captured within 24 hours
- Prediction performance auto-calculated daily
- Accuracy tracking by league, team, confidence level

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| API Downtime | High | Circuit breaker + automatic fallback to scraping |
| API Shutdown | High | Provider abstraction layer + feature flag rollback |
| Team Mapping Errors | Medium | 95%+ high-confidence target + admin review UI |
| Cost Overruns | Low | Quota alerts (80/90/95%) + aggressive caching |
| Data Quality | Low | 1-week parallel run before cutover |

**Emergency Procedure:** Set `ENABLE_API_FOOTBALL=false` → restart app → scraping resumes

---

## Timeline

```
Week 1-2:  Phase 1 - Team/League Matching
Week 3-4:  Phase 2 - Pre-Match Data Enrichment
Week 5-7:  Phase 3 - Historical Backfill (background)
Week 8:    Phase 4 - Post-Match Learning

Total: 8 weeks to full integration
Historical backfill: 6+ months (parallel background job)
```

---

## Success Metrics

### Key Performance Indicators

**Phase 1:**
- ✅ 95%+ teams matched automatically
- ✅ <5% flagged for manual review
- ✅ <100 API calls per draw

**Phase 2:**
- ✅ 90%+ statistics from API-Football
- ✅ 0 scraper failures for API-covered data
- ✅ Prediction quality maintained

**Phase 3:**
- ✅ 100K+ historical matches stored
- ✅ 3-5 years per major league

**Phase 4:**
- ✅ 100% results auto-captured
- ✅ 2-5% accuracy improvement over 3 months

---

## Next Steps

### To Proceed with This Change

1. **Review Documentation**
   - Read [spec.md](spec.md) for technical specifications
   - Read [proposal.md](proposal.md) for strategic context
   - Read [ARCHITECTURE.md](ARCHITECTURE.md) for resilience design

2. **Setup API Access**
   - Sign up for API-Football Basic Plan ($10/month)
   - Add `API_FOOTBALL_API_KEY` to `.env`
   - Set `ENABLE_API_FOOTBALL=true`

3. **Start Implementation**
   - Follow [tasks-revised.md](tasks-revised.md) step-by-step
   - Begin with Phase 1: Team/League Matching
   - Validate with 3 test draws before proceeding

4. **Monitor & Adjust**
   - Track API usage via admin dashboard
   - Review low-confidence team matches
   - Monitor circuit breaker activity

### Questions or Concerns?

- **"What if matching quality is poor?"** - Manual override table handles edge cases, admin UI for review
- **"What if API-Football shuts down?"** - Feature flag disables it instantly, scraping continues
- **"What if we hit quota limits?"** - Alerts at 80/90/95%, aggressive caching, upgrade option available

---

## References

- [API-Football Documentation](https://www.api-football.com/documentation-v3)
- [Team Roster Optimization Guide](https://www.api-football.com/news/post/how-to-get-all-teams-and-players-from-a-league-id)
- [OpenSpec Framework](https://github.com/Fission-AI/OpenSpec)

---

**Status**: Ready for review and approval. Implementation can begin immediately after sign-off.
