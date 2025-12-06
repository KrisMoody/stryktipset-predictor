# Stryktipset AI Predictor - Product Requirements Document

## Executive Summary

The Stryktipset AI Predictor is a personal tool designed to predict Swedish Stryktipset (football pools) outcomes using a combination of data from Svenska Spel's API, intelligent web scraping, and advanced AI analysis. The primary goal is to generate optimal betting coupons with high expected value by leveraging historical patterns, current statistics, and machine learning.

## Vision

To create a reliable, data-driven prediction system that consistently outperforms random guessing and crowd betting patterns, while providing transparent reasoning for all predictions.

## Target User

**Single User (Personal Tool)**: Marcus - an individual interested in making informed Stryktipset betting decisions based on data analysis and AI predictions rather than intuition or crowd behavior.

## User Stories

As a user, I want to:

1. **View Current Draw**: See the current active Stryktipset draw with all 13 matches clearly displayed with teams, leagues, and kickoff times.

2. **Access AI Predictions**: See AI-powered predictions for each match showing:
   - Probability distribution (1, X, 2)
   - Confidence level
   - Key reasoning factors
   - Whether it's suitable as a "spik" (banker bet)

3. **Understand Value Bets**: Identify matches where the AI's assessment differs significantly from "Svenska Folket" (crowd betting patterns), indicating potential value.

4. **Generate Optimal Systems**: Automatically generate betting systems within my budget that:
   - Maximize expected value
   - Balance risk vs. reward
   - Include recommended spiks and garderings
   - Show total cost and expected combinations

5. **Access Detailed Statistics**: View comprehensive match statistics including:
   - xStats (expected goals, expected points)
   - Team form and position
   - Head-to-head history
   - Recent match results
   - News and injury updates

6. **Track Performance**: Monitor prediction accuracy over time to:
   - Build confidence in the system
   - Understand which types of predictions are most reliable
   - See ROI trends
   - Identify areas for improvement

7. **Historical Pattern Analysis**: See similar historical matches and their outcomes to understand the basis for predictions.

8. **Monitor System Health**: View scraping and data collection health to ensure data quality and freshness.

## Core Features

### 1. Data Collection System

**1.1 Svenska Spel API Integration**
- Fetch current and upcoming draws automatically
- Retrieve basic match information (teams, leagues, odds)
- Access Svenska Folket betting distributions
- Store historical draw results for learning

**1.2 Intelligent Web Scraping**
- Scrape detailed match statistics not available via API
- Extract xStats data (expected goals, expected points)
- Collect team statistics (form, position, recent matches)
- Gather head-to-head historical data
- Monitor news and injury updates
- **Anti-detection measures**: Human-like behavior, rate limiting, cookie management
- **Success rate target**: >95% successful scrapes

### 2. AI Prediction Engine

**2.1 Vector Similarity Search**
- Generate embeddings for match contexts
- Find similar historical matches using pgvector
- Identify patterns across different teams and leagues
- Use similar match outcomes to inform predictions

**2.2 Claude AI Integration**
- Generate predictions with probability distributions
- Provide clear reasoning for each prediction
- Identify key factors influencing outcomes
- Determine spik suitability for each match
- Calculate confidence levels

**2.3 Performance Tracking**
- Compare predictions to actual results
- Calculate accuracy metrics (overall, by league, by confidence level)
- Track calibration (are 70% predictions correct 70% of the time?)
- Monitor ROI trends
- Feed performance data back into future predictions

### 3. Coupon Optimization System

**3.1 Expected Value Calculator**
- Compare AI probabilities vs Svenska Folket distributions
- Calculate expected value for each outcome
- Identify value bets (where AI confidence > crowd estimate)
- Factor in odds and potential returns

**3.2 System Generator**
- Identify spik candidates (high confidence single bets)
- Determine optimal garderings (multiple outcome coverage)
- Generate systems within budget constraints
- Optimize for maximum expected value
- Display cost, combinations, and potential returns

### 4. User Interface

**4.1 Dashboard**
- Current draw overview
- All 13 matches with key information
- AI predictions with visual confidence indicators
- Quick access to detailed analysis
- Data freshness indicators

**4.2 Match Detail View**
- Comprehensive statistics display
- xStats visualizations
- Team form and position
- Head-to-head history
- Similar historical matches
- AI reasoning breakdown

**4.3 Coupon Generator**
- Interactive system builder
- Budget configuration
- Spik recommendations
- Automatic optimal system generation
- Cost and combination display

**4.4 Analytics Dashboard**
- Historical prediction accuracy
- Performance charts and trends
- ROI tracking
- Breakdown by league, team, match type

**4.5 Admin/Settings Panel**
- Manual sync triggers
- Scraping health monitoring
- Configuration settings
- Operation logs

## Technical Requirements

### Performance Requirements

- **Speed**: System must generate complete predictions and optimal coupon in <60 seconds
- **Reliability**: Scraping success rate must be >95%
- **Data Freshness**: Match data should be no more than 24 hours old
- **Uptime**: System should be available for Saturday morning use (primary betting time)

### Data Requirements

- **Historical Data**: Store at least 2-3 years of historical match data for pattern recognition
- **Real-time Data**: Fetch current draw data at least every 6 hours
- **Statistics Coverage**: Attempt to scrape detailed stats for all 13 matches

### Scalability Requirements

- Handle multiple concurrent draws (rare but possible)
- Store unlimited historical data without performance degradation
- Support vector similarity search across 10,000+ historical matches

### Security Requirements

- Secure storage of API keys in `.env` file (never committed to git)
- Environment variables: DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY
- No authentication needed (single-user personal tool)
- Prevent exposure of scraping patterns to Svenska Spel

### Configuration Requirements

- **Nuxt UI 4 Setup**:
  - Tailwind CSS and Nuxt UI imports in `assets/css/main.css`
  - CSS file included in `nuxt.config.ts` css array
  - `<UApp>` component wrapping application in `app.vue`
- **Environment Configuration**:
  - Comprehensive `.env` file with all API keys and database credentials
  - `.env.example` template for reference
  - Detailed setup documentation in `docs/ENV_SETUP.md`

## Success Metrics

### Primary Metrics

1. **Prediction Accuracy**: >40% (vs 33% random baseline for 3-way outcomes)
2. **Scraping Success Rate**: >95% of scraping attempts successful
3. **System Availability**: 99% uptime during Saturday mornings (critical betting window)
4. **Generation Speed**: Complete analysis in <60 seconds
5. **Expected Value**: Positive EV on recommended bets vs crowd distribution

### Secondary Metrics

1. **Spik Accuracy**: >60% accuracy on high-confidence spik recommendations
2. **Value Bet Performance**: Positive ROI on identified value bets
3. **Prediction Calibration**: 70% confidence predictions are correct ~70% of the time
4. **Data Freshness**: Average data age <12 hours

## Non-Goals (Out of Scope)

### Explicitly Out of Scope

1. **Multi-user Support**: No authentication, user management, or multi-tenancy
2. **Mobile Applications**: Web UI is sufficient, no native mobile apps
3. **Automatic Bet Placement**: No integration with Svenska Spel for automatic betting
4. **Real-time Odds Tracking**: Odds are fetched periodically, not in real-time
5. **Social Features**: No sharing, commenting, or social interaction features
6. **Payment Processing**: No subscription, payment, or monetization features
7. **Other Betting Games**: Focus only on Stryktipset, not Europatipset, Topptipset, etc.
8. **Live Match Updates**: No in-game statistics or live score tracking

## Technical Architecture

### Technology Stack

- **Frontend**: Nuxt 4 + Nuxt UI 4 + Vue 3 + TypeScript
- **Backend**: Nuxt Server API + Prisma ORM
- **Database**: Supabase (PostgreSQL with pgvector)
- **AI**: Claude API (Anthropic)
- **Scraping**: Playwright with anti-detection measures
- **Embeddings**: OpenAI or Claude embeddings API

### Key Design Decisions

1. **Supabase + Prisma**: Use Supabase for managed PostgreSQL hosting, Prisma for ORM and type generation
2. **Single User**: No authentication layer needed, simplifying architecture
3. **Hybrid Data Collection**: API for basic data + scraping for detailed statistics
4. **Vector Search**: pgvector for efficient similarity search across historical matches
5. **Explainable AI**: Use Claude for transparent, reasoning-based predictions

## Development Phases

### Phase 0: Documentation (1-2 hours)
- Create this PRD
- Define success criteria

### Phase 1: Setup & Database (2-3 hours)
- Initialize Nuxt 4 project
- Configure Supabase + Prisma
- Create database schema with pgvector

### Phase 2: Data Collection (8-11 hours)
- Build Svenska Spel API client
- Implement intelligent web scraping with anti-detection
- Create background sync service

### Phase 3: AI Prediction Engine (4-5 hours)
- Vector embeddings service
- Claude integration for predictions
- Performance tracking system

### Phase 4: Coupon Optimization (2-3 hours)
- Expected value calculator
- System generator algorithm

### Phase 5: API Layer (2-3 hours)
- Nuxt server endpoints
- Integration with Prisma

### Phase 6: User Interface (6-8 hours)
- Dashboard
- Match detail views
- Coupon generator
- Analytics dashboard
- Admin panel

### Phase 7: Testing & Polish (3-4 hours)
- Error handling
- Performance optimization
- Documentation

**Total Estimated Effort**: 28-40 hours

## Risk Assessment

### High Priority Risks

1. **Scraping Detection**: Svenska Spel may detect and block scraping attempts
   - **Mitigation**: Comprehensive anti-detection measures, rate limiting, human-like behavior

2. **API Changes**: Svenska Spel API structure may change
   - **Mitigation**: Robust error handling, API response validation, logging

3. **AI Prediction Accuracy**: Predictions may not outperform random guessing
   - **Mitigation**: Performance tracking, continuous learning, vector similarity for pattern recognition

### Medium Priority Risks

1. **Database Costs**: Supabase costs may increase with data volume
   - **Mitigation**: Monitor usage, implement data retention policies

2. **AI API Costs**: Claude API calls may be expensive
   - **Mitigation**: Cache predictions, batch processing, monitor token usage

3. **Development Time**: Complexity may exceed estimates
   - **Mitigation**: Phased development, MVP first, iterative improvements

### Low Priority Risks

1. **Browser Changes**: Playwright may need updates for new browser versions
   - **Mitigation**: Regular dependency updates, testing

2. **Performance Issues**: Vector search may slow down with large datasets
   - **Mitigation**: Database indexing, query optimization, caching

## Success Criteria Summary

The project will be considered successful when:

✅ PRD clearly documents all requirements and scope
✅ Successfully fetch and store current draws from Svenska Spel API
✅ Scrape detailed match statistics WITHOUT getting blocked (>95% success rate)
✅ Generate AI predictions with clear reasoning for all matches
✅ Find similar historical matches using vector search
✅ Generate optimal coupon systems within budget constraints
✅ Display comprehensive UI with all features working
✅ Track and display prediction performance over time
✅ Monitor scraping health with real-time metrics
✅ Complete system generates predictions in <60 seconds
✅ Prediction accuracy exceeds 33% baseline

## Future Enhancements (Post-MVP)

Potential future improvements not in current scope:

1. **Advanced ML Models**: Train custom models on historical data
2. **Weather Integration**: Factor in weather conditions for predictions
3. **Player Statistics**: Individual player performance tracking
4. **Betting Strategies**: Multiple optimization strategies (conservative, aggressive, balanced)
5. **Export Functions**: Export coupons to various formats
6. **Mobile Optimization**: Better mobile web experience
7. **Notification System**: Alerts when new draws are available
8. **Multiple Game Support**: Expand to Europatipset, Topptipset

## Appendix

### Glossary

- **Stryktipset**: Swedish football pools betting game with 13 matches
- **Spik**: A "banker" or "safe" single bet with high confidence
- **Gardering**: Covering multiple outcomes in a betting system
- **Svenska Folket**: The crowd betting distribution showing how the public is betting
- **xStats**: Expected statistics (xG = expected goals, xP = expected points)
- **Draw**: A specific Stryktipset round/coupon
- **1, X, 2**: Home win, Draw, Away win outcomes

### References

- Svenska Spel API: (endpoint URLs to be determined during implementation)
- Svenska Spel Website: https://www.svenskaspel.se/stryktipset
- Prisma Documentation: https://www.prisma.io/docs
- Nuxt 4 Documentation: https://nuxt.com/docs
- Playwright Documentation: https://playwright.dev/docs

---

**Document Version**: 1.0
**Last Updated**: November 30, 2025
**Author**: Marcus Christoffersson
**Status**: Approved - Ready for Implementation

