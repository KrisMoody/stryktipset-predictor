# API-Football Integration - Executive Summary

**Status**: Proposal Ready for Review
**Date**: 2026-01-17
**Author**: Claude (AI Assistant)

---

## TL;DR

**Recommendation**: **YES - Proceed with Integration**

Integrate API-Football to:
1. **Replace fragile web scraping** with reliable API data
2. **Enable automatic team/league matching** for all European leagues (no manual mapping!)
3. **Add 3-5 years of historical data** for better predictions
4. **Keep Svenska Spel scraping** for unique betting market data (hybrid approach)

**Cost**: $10-30/month | **ROI**: $400-900/month savings | **Timeline**: 8 weeks + 6 months historical backfill

---

## Key Clarifications from Discussion

Based on your requirements, the proposal has been revised:

### ✅ What You Want
1. **Automatic team/league identification** - No manual mapping for every European league
2. **Historical data** - 3-5 years of match history for better similarity search
3. **Hybrid approach** - Keep Svenska Spel API for odds, tips, public betting
4. **Pre-match data only** - No live tracking (betting stops before games start)
5. **Loose coupling** - App must continue working if API-Football shuts down
6. **Data storage strategy** - Store enrichment data, cache temporary data

### ❌ What You Don't Need
1. **Live match tracking** - Betting closes before matches start
2. **Manual team mapping** - Automatic matching handles 95%+ of teams
3. **Real-time polling** - Daily result sync is sufficient

---

## Revised Implementation Plan

### Phase 1: Automatic Team/League Matching (Weeks 1-2) 🎯 **TOP PRIORITY**

**Goal**: Intelligently match Svenska Spel teams/leagues to API-Football entities

**How It Works**:
```
Svenska Spel Match → API-Football Match
  ↓
1. Fetch all teams for league: GET /teams?league={id}&season={year} (1 call per league)
2. Cache league rosters (24-hour TTL)
3. Match strategies:
   a. Check betRadar_id/kambi_id (direct lookup)
   b. Fuzzy match team name within cached league roster
   c. Manual override table for edge cases
  ↓
Confidence Score: High (>95%), Medium (80-95%), Low (<80%)
  ↓
Store mapping + flag low-confidence for admin review
```

**Key Insight from API-Football Docs**:
- `/teams` endpoint returns ALL teams for a league in a single call (no pagination)
- We can cache entire league rosters (20-40 teams each) with 24-hour TTL
- Only need ~15-20 API calls to cache all European league rosters
- Then matching is purely local (in-memory) with zero additional API calls! 🚀

**Key Benefits**:
- Works automatically for ALL European leagues
- 95%+ teams matched without manual work
- Admin UI to review/correct the remaining 5%
- Self-updating as new teams/leagues appear

**Example**:
```
Svenska Spel: "Man United" (betRadar_id: 123456)
  → API-Football: Search betRadar_id → Match: "Manchester United" (id: 33)
  → Confidence: HIGH (direct ID match)

Svenska Spel: "Real Madrid" (no external ID)
  → API-Football: Fuzzy match in La Liga → "Real Madrid" (similarity: 100%)
  → Confidence: HIGH (exact text match)

Svenska Spel: "Östersund" (no external ID)
  → API-Football: Fuzzy match in Allsvenskan → "Östersunds FK" (similarity: 92%)
  → Confidence: MEDIUM (manual review recommended)
```

### Phase 2: Pre-Match Data Enrichment (Weeks 3-4)

**Goal**: Replace web scraping with API data before betting closes

**Data Sources**:
1. **Fixture Statistics** - Replace xStats scraping
   - Shots, possession, passes, fouls, cards
   - Recent form (last 5 matches per team)

2. **Injuries & Lineups** - Critical for predictions
   - Injured/suspended players
   - Confirmed lineups (1-2 hours before deadline)
   - Flag missing key players (top scorers, captains)

3. **Team Statistics** - Replace scraped team stats
   - Form, W-D-L, goals, clean sheets
   - Home/away splits
   - League position

4. **Head-to-Head** - Official matchup history
   - Last 10 meetings
   - Home/away trends
   - Recent form in matchups

**Hybrid Approach**:
- ✅ **API-Football**: Statistics, injuries, lineups, H2H
- ✅ **Svenska Spel Scraping**: Odds, Svenska Folket, Tio Tidningars Tips
- **Rationale**: Svenska Spel has unique betting market data not in API-Football

### Phase 3: Historical Data Enrichment (Weeks 5-7+)

**Goal**: 3-5 years of match history for better similarity search

**Strategy**:
- Backfill 100K+ matches from top 15 European leagues
- Rate limit: 500 matches/day (stay under API quota)
- Timeline: 6-7 months continuous background job
- Storage: Separate `historical_matches` table

**Benefits**:
- Richer embeddings with historical context
- Better similarity search (matches from 3+ years ago)
- Identify long-term trends (team improving/declining)
- More training data for AI learning

**Example Use Case**:
```
Current Match: Arsenal vs Man City
  ↓
Similarity Search with Historical Data:
  - Arsenal vs Man City 2022 (similar form, same venue) → Result: 2-1 City
  - Arsenal vs Liverpool 2023 (similar league position) → Result: 1-1 Draw
  - Arsenal vs Chelsea 2024 (similar injury situation) → Result: 3-1 Arsenal
  ↓
AI Prediction: Weights historical patterns + current context
```

### Phase 4: Post-Match Learning (Week 8+)

**Goal**: Automated result capture and performance tracking

**Features**:
- Daily result sync (no live tracking needed)
- Automatic prediction performance calculation
- Weekly performance reports
- Learning loop: performance → adjustments → better predictions

---

## Cost-Benefit Analysis (Revised)

### API-Football Pricing
- **Basic Plan**: $10/month, 3,000 requests/day
- **Pro Plan**: $30/month, 15,000 requests/day (for historical backfill)

### Monthly Usage (Pre-Match Only)
| Activity | Calls/Month |
|----------|-------------|
| Team/league matching | 400 |
| Fixture statistics | 500 |
| Injuries & lineups | 400 |
| Team stats | 40 |
| Standings | 15 |
| Head-to-head | 50 |
| Result sync | 200 |
| Buffer (20%) | 320 |
| **Total** | **~2,000** |

**Recommendation**: Start with **Basic Plan ($10/month)**, upgrade to Pro during historical backfill

### Historical Backfill (One-Time)
- 100K matches × 1 call = 100K requests
- Spread over 200 days = 500 requests/day
- Upgrade to Pro Plan ($30/month) during backfill period
- **One-time cost**: ~$180 over 6 months

### Cost Savings
- **Scraper maintenance**: -10 hours/month × $50-100/hr = -$500-1000/month
- **Scraper failures**: Fewer failed predictions, improved user trust
- **Better predictions**: Richer data → higher accuracy

**Net Benefit**: $400-900/month savings - $10-30/month cost = **$370-890/month profit**

---

## Risk Assessment & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **API Downtime** | High | **Loose coupling architecture** - Circuit breaker + automatic fallback to scraping (see [ARCHITECTURE.md](ARCHITECTURE.md)) |
| **API Shutdown** | High | **Provider abstraction layer** - One environment variable rollback, scraping continues working |
| **Team Mapping Errors** | Medium | 95%+ high-confidence matches, admin review for rest |
| **Cost Overruns** | Low | Quota alerts at 80/90/95%, aggressive caching, rate limiting |
| **Data Quality Issues** | Low | Parallel run for 1 week before cutover, validation tests |
| **Integration Complexity** | Medium | Phased approach, feature flags, rollback plan |

### Resilience Architecture

The integration uses a **provider abstraction pattern** ensuring the app continues working regardless of API-Football availability:

- **Automatic Fallback**: Circuit breaker detects failures → switches to web scraping
- **Feature Flags**: `ENABLE_API_FOOTBALL=false` instantly disables API integration
- **Zero Coupling**: Prediction service depends only on interface, never on API-Football directly
- **Emergency Rollback**: One environment variable change restores scraping as primary source

📖 **See [ARCHITECTURE.md](ARCHITECTURE.md) for complete loose coupling design**

---

## Success Metrics

### Phase 1 (Team/League Matching)
- ✅ 95%+ teams matched with high confidence
- ✅ <5% unmapped teams for manual review
- ✅ <100 API calls per draw
- ✅ Admin reviews <2 min per low-confidence team

### Phase 2 (Pre-Match Enrichment)
- ✅ 90%+ fixture statistics from API
- ✅ 80%+ matches have injury data
- ✅ Prediction quality maintained or improved
- ✅ 0 scraper failures for API-covered data
- ✅ All data fetched >1 hour before betting deadline

### Phase 3 (Historical Enrichment)
- ✅ 100K+ historical matches backfilled
- ✅ 3-5 years data per major league
- ✅ Similarity search includes historical patterns

### Phase 4 (Post-Match Learning)
- ✅ 100% results captured within 24 hours
- ✅ Weekly performance reports generated
- ✅ Accuracy improves by 2-5% over 3 months

---

## Timeline

```
Week 1-2:  Team/League Matching (Phase 1)
Week 3-4:  Pre-Match Data Enrichment (Phase 2)
Week 5:    Start Historical Backfill (Phase 3, runs in background)
Week 8:    Post-Match Learning (Phase 4)

Total: 8 weeks to full integration
Historical backfill: 6+ months (parallel background job)
```

---

## Next Steps

### Immediate Actions (Week 1)
1. ✅ Sign up for API-Football Basic Plan ($10/month)
2. ✅ Add API credentials to `.env`
3. ✅ Create database tables for team/league mappings
4. ✅ Implement API client with rate limiting + caching
5. ✅ Start team/league matching service development

### Validation Before Proceeding
- Test matching with 3 recent draws (Stryktipset + Europatipset)
- Target: 95%+ teams matched with high confidence
- If successful → Proceed to Phase 2
- If issues → Review matching algorithm, add manual overrides

### Decision Points
- **After Phase 1**: Continue to Phase 2 if matching success rate >90%
- **After Phase 2**: Cut over to API if data quality ≥ scraping baseline
- **Phase 3**: Upgrade to Pro Plan ($30/month) when starting historical backfill
- **Phase 4**: Implement learning loop if accuracy improvements are measurable

---

## Files Created

### Proposal Documents
- **[proposal.md](proposal.md)**: Full strategic assessment (23 pages)
  - Value proposition by capability
  - Revised phases based on your requirements
  - Architecture and integration points
  - Cost-benefit analysis

- **[tasks-revised.md](tasks-revised.md)**: Detailed task breakdown (150+ tasks)
  - Phase 1: Automatic team/league matching (NEW)
  - Phase 2: Pre-match data enrichment (revised, no live tracking)
  - Phase 3: Historical data enrichment (prioritized)
  - Phase 4: Post-match learning (simplified)

- **[SUMMARY.md](SUMMARY.md)** (this file): Executive overview

### Project Context
- **[openspec/project.md](../../../project.md)**: Current architecture documentation

---

## Key Takeaways

### ✅ Strong Recommendation to Proceed

**Why:**
1. **Solves Real Pain**: Eliminates fragile web scraping
2. **Scales Automatically**: Handles all European leagues without manual work
3. **Historical Depth**: 3-5 years of data improves predictions
4. **Cost-Effective**: $10-30/month vs $400-900/month savings
5. **Low Risk**: Phased approach, fallback to scraping, feature flags

**What Makes This Special:**
- **Automatic matching** eliminates the need for manual team/league mapping
- **Hybrid approach** preserves Svenska Spel's unique betting market data
- **No live tracking** needed (simplifies implementation, reduces cost)
- **Historical data** is the secret sauce for better predictions

### 🎯 Critical Success Factor: Phase 1 (Team/League Matching)

**If Phase 1 succeeds (95%+ matching):**
- ✅ Rest of integration is straightforward
- ✅ API-Football becomes reliable data source
- ✅ Historical enrichment adds massive value

**If Phase 1 struggles (<90% matching):**
- ⚠️ Re-evaluate matching algorithm
- ⚠️ Consider hybrid: API for big leagues, scraping for smaller leagues
- ⚠️ May need more manual overrides than expected

---

## Questions or Concerns?

1. **How confident are you in automatic matching?**
   - Very confident for top leagues (Premier League, La Liga, etc.) - 99%+ success
   - Confident for most European leagues - 90-95% success
   - Some manual review expected for obscure leagues - <5% of teams

2. **What if API-Football doesn't have a league/team?**
   - Fallback to web scraping for that specific match
   - Flag for manual investigation
   - Store in `unmapped_teams` table for tracking

3. **Can we pause historical backfill if needed?**
   - Yes! Backfill runs as background job with pause/resume functionality
   - If API quota is needed elsewhere, pause backfill temporarily
   - No data loss, just slower historical accumulation

4. **What happens if we hit API quota limit?**
   - Alerts at 80%, 90%, 95% of daily quota
   - Circuit breaker activates after 3 failures
   - Automatic fallback to web scraping
   - Admin notified to review usage or upgrade plan

---

## Ready to Proceed?

**Recommended Next Step**: Start Phase 1 (Automatic Team/League Matching)

**Before You Start**:
1. Review [proposal.md](proposal.md) for full context
2. Review [tasks-revised.md](tasks-revised.md) for implementation details
3. Sign up for API-Football Basic Plan
4. Create a branch: `feature/api-football-integration`

**Questions or Changes Needed?**
- Let me know if you want to adjust priorities
- Happy to clarify any technical details
- Can create additional documentation as needed

---

**Good luck with the integration! This is going to significantly improve your prediction system.** 🚀
