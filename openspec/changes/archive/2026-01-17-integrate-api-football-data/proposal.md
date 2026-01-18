# Proposal: Integrate API-Football Data Sources

> **OpenSpec Note:** This document explains **WHY** this change should be made. For **WHAT** (interface specs), see [spec.md](spec.md). For **HOW** (implementation steps), see [tasks-revised.md](tasks-revised.md).

**Change ID**: `integrate-api-football-data`
**Status**: Proposed
**Author**: AI Assistant (based on user requirements)
**Date**: 2026-01-17

---

## Overview

This proposal assesses the strategic value of integrating API-Football (v3.9.3) into the ST-Predictor application and outlines the business case for replacing fragile web scraping with reliable API data, enabling automatic team/league matching, and enriching predictions with 3-5 years of historical context.

## Strategic Assessment

### Current State Analysis

**Strengths:**
- Functional Svenska Spel API integration for draw/match basics
- Working web scraping for xStats and team statistics
- Claude AI predictions using available data
- Vector similarity search with pgvector

**Pain Points:**
1. **Web Scraping Fragility**
   - Breaks when Svenska Spel changes website structure
   - Rate limiting and detection risks
   - Requires constant maintenance
   - No guaranteed data availability

2. **Limited Data Depth**
   - No detailed player statistics or injuries
   - Limited historical match data
   - No live match events or updates
   - Missing comprehensive team/venue information

3. **Prediction Context Gaps**
   - Cannot analyze player form, transfers, or absences
   - No access to detailed fixture statistics (shots, possession, etc.)
   - Limited league-wide context (standings updates lag)
   - No access to expert predictions from bookmakers

### API-Football Value Proposition

**High-Value Capabilities (Immediate Impact):**

1. **Fixture Statistics** (API: `/fixtures/statistics`, `/fixtures/events`, `/fixtures/players`)
   - **Value**: Replace scraped xStats with official data
   - **Impact**: More reliable, comprehensive match statistics
   - **Use Case**: Enhanced prediction context with shots, possession, passes, tackles
   - **Cost**: ~3-5 API calls per match (statistics + events + players)
   - **Update Frequency**: After each fixture completes

2. **Player Injuries & Availability** (API: `/injuries`, `/fixtures/lineups`, `/sidelined`)
   - **Value**: Critical context for predictions - missing key players dramatically affects outcomes
   - **Impact**: Reduces prediction errors caused by unknown absences
   - **Use Case**: Alert AI when star players are injured/suspended
   - **Cost**: ~2-3 API calls per match
   - **Update Frequency**: Daily for injuries, 1 hour before match for lineups

3. **Team Statistics & Form** (API: `/teams/statistics`, `/standings`)
   - **Value**: Replace scraped team data with official, structured statistics
   - **Impact**: Consistent, reliable form analysis
   - **Use Case**: Recent form, home/away performance, goals by period
   - **Cost**: 1-2 API calls per team per season
   - **Update Frequency**: After each fixture

4. **Head-to-Head Data** (API: `/fixtures/headtohead`)
   - **Value**: Official historical matchup data
   - **Impact**: Better similarity matching vs current scraping
   - **Use Case**: Direct team matchup history with full details
   - **Cost**: 1 API call per unique matchup
   - **Update Frequency**: Cache with long TTL (matchups don't change often)

5. **Live Match Updates** (API: `/fixtures?live=all`, `/fixtures/events`)
   - **Value**: Real-time score and event tracking
   - **Impact**: Enable in-play analysis and post-match validation
   - **Use Case**: Track ongoing Stryktipset matches, update predictions dynamically
   - **Cost**: 1 API call per minute during live matches
   - **Update Frequency**: Every 60 seconds during matches

**Medium-Value Capabilities (Strategic Enhancement):**

6. **Comprehensive League Data** (API: `/leagues`, `/standings`)
   - **Value**: Full league coverage with accurate standings
   - **Impact**: Better league context for predictions
   - **Use Case**: Understand league positions, points, relegation battles
   - **Cost**: 1 API call per league per day
   - **Update Frequency**: Daily

7. **Venue Information** (API: `/venues`)
   - **Value**: Stadium details, surface type, capacity
   - **Impact**: Home advantage context, pitch condition effects
   - **Use Case**: Factor venue characteristics into predictions
   - **Cost**: One-time per venue
   - **Update Frequency**: Rarely (venues don't change)

8. **Player Statistics & Form** (API: `/players`, `/players/topscorers`)
   - **Value**: Individual player performance tracking
   - **Impact**: Identify in-form players, goal threats
   - **Use Case**: Weight predictions by player quality
   - **Cost**: ~10-20 API calls per league per season
   - **Update Frequency**: After each fixture

9. **Predictions & Odds** (API: `/predictions`, `/odds`)
   - **Value**: Bookmaker predictions and market odds
   - **Impact**: Ensemble predictions, value bet identification
   - **Use Case**: Compare AI predictions vs market consensus
   - **Cost**: 1-2 API calls per match
   - **Update Frequency**: 2 hours before kick-off

**Low-Value Capabilities (Nice-to-Have):**

10. **Transfers** (API: `/transfers`)
    - **Value**: Track player movements
    - **Impact**: Minimal for Stryktipset (focuses on match outcomes, not long-term squad building)
    - **Use Case**: Historical context only

11. **Trophies & Achievements** (API: `/trophies`)
    - **Value**: Team/player history
    - **Impact**: Low - recent form matters more than past achievements
    - **Use Case**: Brand building, UI enrichment

12. **Coach Information** (API: `/coachs`)
    - **Value**: Manager details and career
    - **Impact**: Minimal - tactical impact hard to quantify
    - **Use Case**: Context for major team changes

## Recommended Implementation Strategy

### Phase 1: Automatic Team/League Identification (Weeks 1-2)
**Goal**: Intelligent matching of Svenska Spel matches to API-Football entities

**Scope:**
1. **Multi-Strategy Matching Service**
   - Endpoint: `/teams`, `/leagues`, `/countries`
   - Strategy 1: Match by betRadar_id or kambi_id (Svenska Spel provides these)
   - Strategy 2: Fuzzy text matching (team name + league + country)
   - Strategy 3: Manual override table for problem cases
   - Create confidence scoring (high: 95%+, medium: 80-95%, low: <80%)
   - Store all matches with confidence levels for audit

2. **League Identification**
   - Endpoint: `/leagues?country=X`
   - Match Svenska Spel league names to API-Football leagues
   - Handle variations: "Premier League" vs "England - Premier League"
   - Use country context to disambiguate (multiple "Premier League" exist)
   - Cache league mappings (static data, rarely changes)

3. **Team Identification**
   - Endpoint: `/teams?league=X&season=Y` (single call gets ALL teams in league)
   - First try: betRadar_id/kambi_id direct lookup
   - Fallback: Fuzzy match on team name within correct league
   - Handle name variations: "Man United" vs "Manchester United"
   - Flag low-confidence matches (<80%) for manual review
   - Create admin UI to review and confirm/correct matches
   - **Note**: `/teams` returns all teams for a league in one call (no pagination needed)

**Benefits:**
- **Scalability**: Works for all European leagues automatically
- **Coverage**: No manual mapping needed for 95%+ of teams
- **Maintenance**: Self-updating as new teams/leagues appear
- **Audit Trail**: Track confidence and review low-confidence matches

**Trade-offs:**
- **Initial Complexity**: Need robust matching algorithm
- **Edge Cases**: Some teams will need manual override
- **API Usage**: ~100-200 calls for initial league/team discovery per draw

**Validation:**
- Test with 3 recent draws (Stryktipset + Europatipset)
- Target: 95%+ teams matched with high confidence
- Manual review workflow for low-confidence matches

### Phase 2: Pre-Match Data Enrichment (Weeks 3-4)
**Goal**: Replace web scraping with API data before betting closes

**Scope:**
1. **Fixture Statistics Service**
   - Endpoint: `/fixtures/statistics`, `/fixtures/events`, `/fixtures/players`
   - Replace: `scraper/v3` xStats scraping
   - Data: shots, possession, passes, fouls, cards, player ratings
   - **Timing**: Fetch after Svenska Spel sync, cache forever (pre-match data doesn't change)
   - Focus: Recent form data (last 5 matches per team)

2. **Injury & Availability Service**
   - Endpoint: `/injuries`, `/fixtures/lineups`, `/sidelined`
   - Replace: Current lineup scraping
   - Data: injured players, suspensions, confirmed lineups (if available pre-match)
   - **Timing**: Daily refresh + 24 hours before each match
   - **Critical**: Flag missing key players (top scorers, captains)

3. **Team Statistics Service**
   - Endpoint: `/teams/statistics`, `/standings`
   - Replace: Team stats scraping
   - Data: form, W-D-L, goals, clean sheets, league position, home/away splits
   - **Timing**: Daily refresh
   - Focus: Current season performance

4. **Head-to-Head Service**
   - Endpoint: `/fixtures/headtohead`
   - Official historical matchup data
   - **Timing**: Fetch once per unique matchup, cache forever
   - Data: Last 10 meetings, results, goals, venue

**Benefits:**
- **Reliability**: No scraper breakage
- **Completeness**: Consistent data across all leagues
- **Maintenance**: Zero scraper debugging
- **Timing**: All data available well before betting closes

**Trade-offs:**
- **Cost**: ~$30-50/month for API subscription
- **No Live Data**: Only pre-match context (which is what you need!)
- **Migration**: Update prediction service context

**Validation:**
- Parallel run API + scraping for 1 week
- Verify prediction quality maintains/improves
- Confirm all data fetched >1 hour before betting deadline

### Phase 3: Historical Data Enrichment (Weeks 5-7)
**Goal**: Deep historical analysis for better similarity search

**Scope:**
1. **Historical Match Backfill**
   - Endpoint: `/fixtures` with date ranges
   - Backfill 3-5 years of historical data for all leagues
   - Strategy: Start with most common leagues (Premier League, La Liga, etc.)
   - Rate limit: 500 matches/day to avoid quota issues
   - **Timeline**: Backfill runs continuously as background job over 4-6 weeks

2. **Historical Statistics**
   - Fetch fixture statistics for historical matches
   - Store in `historical_matches` table separate from current draws
   - Include: final scores, statistics, lineups (when available)
   - Purpose: Richer embeddings and similarity search

3. **Enhanced Similarity Search**
   - Re-generate embeddings with historical context
   - Include: team form, player absences, venue, league context
   - Improve match recommendations for AI predictions
   - Add historical trends (team improving/declining)

4. **Head-to-Head Archives**
   - Use `/fixtures/headtohead` to get deep matchup history
   - Store 10-20 previous meetings per matchup
   - Identify patterns: home dominance, recent form shifts

**Benefits:**
- **Learning**: 3-5 years of training data per league
- **Patterns**: Identify long-term trends and matchup tendencies
- **Similarity**: Better historical match recommendations
- **Validation**: Compare current form vs historical averages

**Trade-offs:**
- **Storage**: Significant database growth (~100K+ matches)
- **Backfill Time**: 4-6 weeks continuous background processing
- **API Usage**: One-time spike of ~50K requests (spread over weeks)

**Validation:**
- Backfill complete for top 10 European leagues
- Similarity search returns relevant historical matches
- Historical context improves prediction reasoning

### Phase 4: Post-Match Learning (Week 8+)
**Goal**: Automated result capture and performance tracking

**Scope:**
1. **Result Sync Service**
   - Endpoint: `/fixtures?date=X&status=FT`
   - Daily background job: Fetch completed fixtures
   - Match to Svenska Spel games by fixture ID
   - Update match results automatically
   - **No live tracking needed** - just check once per day after matches finish

2. **Performance Validation**
   - Trigger prediction performance calculation automatically
   - Update coupon win/loss status
   - Track prediction accuracy by league, team, confidence level
   - Generate weekly performance reports

3. **Statistical Enrichment**
   - Fetch post-match statistics for completed games
   - Store final statistics (shots, possession, xG if available)
   - Use for future embeddings and learning

**Benefits:**
- **Automation**: Zero manual result entry
- **Learning**: Automatic accuracy tracking
- **Insights**: Understand which leagues/scenarios AI predicts best

**Trade-offs:**
- **Timing**: Results available next day (vs immediately after match)
- **API Usage**: ~100 calls/day for result checks

**Validation:**
- 100% of match results captured within 24 hours
- Prediction performance auto-calculated daily

## Implementation Architecture

### New Services

**1. API-Football Client (`server/services/api-football-client.ts`)**
```typescript
// Axios-based client with rate limiting, caching, error handling
// Manage API key, base URL, request/response logging
// Implement retry logic for transient failures
```

**2. Fixture Data Service (`server/services/api-football/fixture-data.ts`)**
```typescript
// Fetch and normalize fixture statistics, events, lineups
// Cache completed match data (immutable)
// Update match_scraped_data table with API data
```

**3. Team Data Service (`server/services/api-football/team-data.ts`)**
```typescript
// Fetch team statistics, standings, form
// Cache with daily TTL
// Replace current scraper-based team stats
```

**4. Injury Service (`server/services/api-football/injury-service.ts`)**
```typescript
// Fetch injuries, lineups, sidelined players
// Alert on key player absences
// Cache with 1-hour TTL before matches
```

**5. Live Match Service (`server/services/api-football/live-matches.ts`)**
```typescript
// Poll live fixtures during active draws
// Update match results in real-time
// Trigger post-match processing
```

### Database Changes

**New Tables:**
```sql
-- API-Football metadata
CREATE TABLE api_football_cache (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  params JSONB,
  response JSONB NOT NULL,
  cached_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(endpoint, params)
);

-- API usage tracking
CREATE TABLE api_football_usage (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  status_code INT,
  response_time_ms INT,
  cost_estimate DECIMAL(10, 6),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced match data
ALTER TABLE matches
  ADD COLUMN api_football_id INT,
  ADD COLUMN api_football_synced_at TIMESTAMP;
```

### Integration Points

**1. Prediction Service Context**
- Update `prepareMatchContext()` to include API-Football data
- Add player injury alerts to AI prompt
- Include detailed fixture statistics

**2. Draw Sync Service**
- After Svenska Spel sync, trigger API-Football data fetch
- Match teams/leagues between systems (mapping table)
- Fallback to scraping if API unavailable

**3. Background Jobs**
- Daily: Refresh team statistics, standings, injuries
- Hourly: Check upcoming lineup confirmations
- Live: Poll fixtures during active draws (every 60s)
- Weekly: Backfill historical data

## Cost-Benefit Analysis

### API-Football Pricing (Estimated)
- **Free Plan**: 100 requests/day (insufficient)
- **Basic Plan**: ~$10/month, 3,000 requests/day (may be sufficient)
- **Pro Plan**: ~$30/month, 15,000 requests/day (recommended)
- **Custom Plan**: $50-100/month for higher quotas

### Estimated Monthly Usage (Revised for Pre-Match Only)
- **Team/League Matching**: 50 matches/week × 2 calls = 400 calls/month
- **Fixture Statistics** (recent form): 50 matches/week × 100 teams × 1 call/10 matches = 500 calls/month
- **Injuries & Lineups**: 50 matches/week × 2 calls = 400 calls/month
- **Team Stats**: 40 unique teams × 1 call = 40 calls/month (cached daily)
- **Standings**: 15 leagues × 1 call = 15 calls/month (cached daily)
- **Head-to-Head**: 50 unique matchups × 1 call = 50 calls/month (cached forever)
- **Result Sync**: 50 matches/week × 1 call = 200 calls/month
- **Buffer**: 20% headroom = +320 calls

**Total: ~2,000 requests/month (Basic Plan sufficient)**

**Historical Backfill (one-time):**
- 100K historical matches × 1 call = 100K calls
- Spread over 200 days = 500 calls/day (stay under daily quota)
- **One-time cost**: ~$50-100 depending on plan

### Cost Savings
- **Scraper Maintenance**: -10 hours/month engineer time (~$500-1000)
- **Scraper Failures**: -5 failed predictions/week (improved user trust)
- **Data Quality**: Better predictions → higher user engagement

**Net Benefit: ~$400-900/month savings vs $10-30 API cost**

### ROI Factors
1. **Reliability**: Eliminate scraping as single point of failure
2. **Scalability**: Support more leagues without scraper development
3. **Features**: Enable live tracking, player analysis
4. **Maintenance**: Reduce ongoing debugging and updates

## Risks & Mitigation

### Risk 1: API Availability
**Impact**: High - predictions fail if API down
**Mitigation**:
- Implement fallback to web scraping
- Cache all API responses with generous TTL
- Monitor API status and uptime

### Risk 2: Data Mapping
**Impact**: Medium - Swedish teams may not match API-Football IDs
**Mitigation**:
- Create mapping table (Svenska Spel ID ↔ API-Football ID)
- Manual mapping for Allsvenskan teams initially
- Fuzzy matching algorithm for international teams

### Risk 3: Cost Overrun
**Impact**: Medium - unexpected API usage could exceed budget
**Mitigation**:
- Implement request quota tracking
- Alert at 80% monthly limit
- Aggressive caching strategy (7-day TTL for historical data)
- Rate limiting on non-critical calls

### Risk 4: Data Quality Differences
**Impact**: Low - API data format may differ from current expectations
**Mitigation**:
- Parallel run: API + scraping for 2 weeks
- Validate data equivalence
- Update prediction service gradually

## Alternative Approaches

### Option A: Hybrid (Recommended)
- Use API-Football for critical data (injuries, statistics, live)
- Keep scraping for Svenska Spel-specific data (odds, tips)
- **Pros**: Best of both worlds, reduced API costs
- **Cons**: Maintain some scraper code

### Option B: Full API Migration
- Replace all scraping with API-Football
- **Pros**: Maximum reliability, zero scraper maintenance
- **Cons**: Higher costs, possible data gaps for Swedish-specific content

### Option C: Keep Scraping, Add API Selectively
- Keep current scraping, add API only for new features (live, players)
- **Pros**: Minimal risk, incremental adoption
- **Cons**: Maintains scraper technical debt

## Success Metrics

### Phase 1 (API Integration)
- **Data Availability**: 99%+ uptime for API-sourced data
- **Scraper Elimination**: 80% reduction in scraper usage
- **Prediction Quality**: Maintain or improve accuracy (baseline: current %)

### Phase 2 (Live Tracking)
- **Real-time Updates**: < 90 second lag for live scores
- **Auto-validation**: 100% of results captured automatically

### Phase 3 (Enhanced Predictions)
- **Accuracy Improvement**: +3-5% prediction accuracy with player context
- **Value Bets**: Identify 2-3 contrarian opportunities per draw

### Phase 4 (Historical Data)
- **Coverage**: 3+ years of historical data per league
- **Similarity**: Improved match recommendations (user feedback)

## Open Questions

1. **Team Mapping**: How to reliably match Svenska Spel teams to API-Football IDs?
   - **Proposed**: Manual mapping table for Allsvenskan, fuzzy match for international

2. **Data Freshness**: What's acceptable lag for injuries and lineups?
   - **Proposed**: 1-hour refresh before matches, daily for non-urgent data

3. **API Plan**: Which subscription tier is optimal?
   - **Proposed**: Start with Pro ($30/month), upgrade if usage grows

4. **Fallback Strategy**: When should we fall back to scraping?
   - **Proposed**: If API fails 3× in a row, automatic fallback for 30 minutes

5. **Migration Timeline**: Full cutover or gradual rollout?
   - **Proposed**: 2-week parallel run, then cutover by data type

6. **User-Facing Changes**: Should we expose API-sourced data differently?
   - **Proposed**: Internal change only, no UI changes initially

## Recommendation

**Proceed with Revised Phased Implementation (Hybrid, Pre-Match Focus)**

**Rationale:**
1. **Automatic Scaling**: Phase 1 matching service handles all European leagues automatically
2. **Cost-Effective**: Only ~2,000 requests/month = Basic Plan at $10/month sufficient
3. **Pre-Match Focus**: All data fetched before betting closes (no live polling needed)
4. **Historical Depth**: Phase 3 enables 3-5 years of training data for better predictions
5. **Hybrid Approach**: Keep Svenska Spel API for odds, Tio Tidningars Tips, public betting
6. **Strong ROI**: $400-900/month savings vs $10-30/month cost = excellent ROI

**Revised Priority Order:**
1. **Phase 1** (Weeks 1-2): Automatic team/league matching - CRITICAL for European coverage
2. **Phase 2** (Weeks 3-4): Pre-match data (injuries, stats, H2H) - Replaces scraping
3. **Phase 3** (Weeks 5-7): Historical backfill - Improves similarity search
4. **Phase 4** (Week 8+): Post-match result sync - Automates learning

**Key Differences from Original Plan:**
- ❌ No live match tracking (betting stops before matches start)
- ✅ Automatic team/league identification (not manual mapping)
- ✅ Historical data prioritized (better predictions)
- ✅ Lower costs ($10-30/month vs $30-50/month)

**Next Steps:**
1. Get API-Football Basic Plan ($10/month) - upgrade to Pro if needed during backfill
2. Implement Phase 1: Automatic team/league matching service
   - Leverage betRadar_id/kambi_id from Svenska Spel
   - Fuzzy matching algorithm for fallback
   - Admin UI for low-confidence review
3. Test matching with 3 recent draws (aim for 95%+ success rate)
4. Implement Phase 2: Pre-match data enrichment
5. Run parallel API + scraping for 1 week
6. Cut over to API-Football for pre-match data
7. Start Phase 3: Historical backfill (background job, 4-6 weeks)

**Timeline**:
- **Core Integration** (Phases 1-2): 4 weeks
- **Historical Enrichment** (Phase 3): 6 weeks (parallel background job)
- **Post-Match Automation** (Phase 4): 1 week
- **Total**: 8 weeks to full integration, historical data continues accumulating

## Appendix: Key API Endpoints

### High Priority
- `/fixtures` - Match details
- `/fixtures/statistics` - Match statistics
- `/fixtures/events` - Match events (goals, cards)
- `/fixtures/lineups` - Starting lineups
- `/fixtures/players` - Player match statistics
- `/injuries` - Injury list
- `/teams/statistics` - Team season statistics
- `/standings` - League standings

### Medium Priority
- `/predictions` - Bookmaker predictions
- `/odds` - Betting odds
- `/players` - Player details
- `/players/topscorers` - Goal leaders
- `/fixtures/headtohead` - H2H history

### Low Priority
- `/transfers` - Transfer history
- `/trophies` - Achievements
- `/coachs` - Manager info
- `/venues` - Stadium details
