# ST-Predictor Project Overview

## Purpose
An AI-powered prediction system for Swedish football pool betting games (Stryktipset, Europatipset, Topptipset) using advanced web scraping, Claude AI analysis, and historical match similarity search.

## Current Architecture

### Data Sources
1. **Svenska Spel API** - Primary source for draw and match data
   - Draw information (draw number, dates, status)
   - Match metadata (teams, leagues, times)
   - Odds data (current, start, favourite)
   - Public betting patterns (Svenska Folket)
   - Expert tips (Tio Tidningars Tips)

2. **Web Scraping** - Supplementary match statistics
   - xStats (expected goals, expected points)
   - Team statistics (form, position, goals)
   - Lineup/injury information
   - Head-to-head data
   - Uses Playwright with anti-detection

3. **Claude AI** - Prediction generation
   - Analyzes all available data
   - Generates outcome probabilities (1/X/2)
   - Provides reasoning and key factors
   - Identifies spik candidates

4. **OpenAI Embeddings** - Vector similarity search
   - text-embedding-3-small model
   - Finds similar historical matches
   - Team matchup analysis
   - Stored in pgvector

### Core Capabilities
- Multi-game support (Stryktipset, Europatipset, Topptipset)
- Background sync every 6 hours
- Coupon optimization within budget
- Performance tracking and learning
- Real-time scraper health monitoring

### Technology Stack
- **Frontend**: Nuxt 4, Vue 3, TypeScript, Nuxt UI
- **Backend**: Nuxt Server API, Prisma ORM
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI**: Claude 3.5 Sonnet, OpenAI embeddings
- **Scraping**: Playwright with anti-detection

### Data Model (Key Tables)
- `draws` - Pool game rounds
- `matches` - Individual matches within draws
- `teams`, `leagues`, `countries` - Reference data
- `match_odds` - Betting odds and public sentiment
- `match_scraped_data` - xStats, statistics, lineups
- `match_embeddings` - Vector embeddings for similarity
- `predictions` - AI-generated predictions
- `prediction_performance` - Accuracy tracking

### Current Limitations
1. **Match Data Quality**
   - Relies on web scraping for detailed statistics
   - No official API for player-level data
   - No real-time match events during games
   - No historical match archives beyond recent seasons

2. **Prediction Context**
   - Limited to current season data
   - No deep historical team performance
   - No player-specific statistics (injuries, form)
   - No weather or external factors

3. **League Coverage**
   - Focused on leagues in Svenska Spel pools
   - No comprehensive global coverage
   - Limited historical depth per league

## Project Structure
- `/server/services/` - Business logic
  - `svenska-spel-api.ts` - API client
  - `draw-sync.ts` - Draw synchronization
  - `prediction-service.ts` - AI predictions
  - `embeddings-service.ts` - Vector search
  - `scraper/` - Web scraping system
- `/server/api/` - HTTP endpoints
- `/pages/` - Frontend views
- `/prisma/` - Database schema
