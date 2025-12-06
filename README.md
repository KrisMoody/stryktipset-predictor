# Stryktipset AI Predictor

An AI-powered prediction system for Swedish Stryktipset using Nuxt 4, Supabase, Prisma, and Claude AI. This comprehensive tool combines data from Svenska Spel's API, intelligent web scraping with anti-detection, and advanced AI analysis to generate optimal betting coupons.

## ✨ Features

- 🤖 **AI-Powered Predictions**: Uses Claude AI to analyze matches and generate predictions with reasoning
- 📊 **Comprehensive Statistics**: Web scraping of xStats, team statistics, head-to-head, and news
- 🎯 **Coupon Optimization**: Generates optimal betting systems within budget constraints
- 📈 **Vector Similarity Search**: Finds similar historical matches using pgvector
- 🔍 **Performance Tracking**: Tracks prediction accuracy and learns from results
- 🛡️ **Anti-Detection Scraping**: Advanced techniques to avoid detection and rate limiting
- 🎨 **Modern UI**: Built with Nuxt UI 4 for a beautiful, responsive interface
- ⏰ **Background Jobs**: Automatic syncing every 6 hours

## 🏗️ Tech Stack

- **Frontend**: Nuxt 4 + Nuxt UI 4 + Vue 3 + TypeScript
- **Backend**: Nuxt Server API + Prisma ORM
- **Database**: Supabase (PostgreSQL with pgvector)
- **AI**: Claude 3.5 Sonnet (Anthropic) + OpenAI Embeddings
- **Scraping**: Playwright with comprehensive anti-detection measures

## 📋 Prerequisites

- Node.js 20+
- A Supabase account and project
- Anthropic API key (Claude)
- OpenAI API key (for embeddings)

## 🚀 Installation

> **⚠️ IMPORTANT**: The `.env` file is NOT included in this repository for security reasons. You MUST create it manually. See the [Setup Guide](docs/SETUP.md) for complete instructions.

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd st-predictor
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Project Settings > Database** and copy:
   - Connection string (URI format)
   - Project URL
   - Anon key

### 3. Enable pgvector Extension

In your Supabase SQL Editor, run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. Configure Environment Variables

**CRITICAL**: Create a `.env` file in the project root with your actual credentials.

You can copy from the example template:
```bash
cp .env.example .env
```

Then open `.env` and replace ALL placeholder values with your actual credentials:

```env
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Supabase
SUPABASE_URL="https://[project-ref].supabase.co"
SUPABASE_ANON_KEY="your-anon-key"

# AI APIs
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."

# Svenska Spel API
SVENSKA_SPEL_API_BASE_URL="https://api.svenskaspel.se/draw/1"

# AI Scraper (Optional - enables V3 hybrid scraper)
ENABLE_SCRAPER_V3=true           # Enable hybrid AI+DOM scraper
ENABLE_AI_SCRAPER=true           # Enable AI scraping within V3
AI_SCRAPER_URL=http://localhost:8000
```

**Important**: 
- `.env` file should NEVER be committed to git (it's already in `.gitignore`)
- All values above are placeholders - replace with your actual credentials
- For detailed instructions on where to get each value, see the [Environment Setup Guide](docs/ENV_SETUP.md)
- AI Scraper settings are optional - without them, the app uses DOM-only scraping

### 5. Verify Nuxt UI Configuration

Ensure `assets/css/main.css` exists with Nuxt UI imports:

```css
@import 'tailwindcss';
@import '@nuxt/ui';
```

This file should already be created, but verify it exists.

### 6. Initialize Database

```bash
npm run db:push
```

You should see confirmation that the schema was pushed successfully.

### 7. Start Development Server

**Option A: Nuxt Only (uses DOM scraping)**
```bash
npm run dev
```

**Option B: With AI Scraper (recommended)**
```bash
# First, ensure Python venv is set up (one-time setup):
cd services/ai-scraper
python3 -m venv ~/ai-scraper-venv  # or use local venv
source ~/ai-scraper-venv/bin/activate
pip install -r requirements.txt
crawl4ai-setup
cd ../..

# Then run both services:
npm run dev:all
```

**Option C: Separate Terminals**
```bash
# Terminal 1: Nuxt
npm run dev

# Terminal 2: AI Scraper
npm run dev:ai
```

Visit http://localhost:3000 (Nuxt) and http://localhost:8000/docs (AI Scraper API)

**Note**: The first startup will take longer as Nuxt compiles and Prisma generates the client. The AI scraper is optional - the app will fall back to DOM scraping if it's not running.

## 📖 Usage Guide

### First Steps

1. **Sync Draws**: Click "Sync Draws" on the dashboard to fetch current Stryktipset draws
2. **Generate Predictions**: Click "Generate Predictions" to create AI predictions for all matches
3. **View Analytics**: Navigate to the analytics page to see prediction performance
4. **Optimize Coupon**: Once all matches have predictions, generate an optimal coupon

### Features in Detail

#### Dashboard
- View all active draws
- See match count and prediction status
- Quick actions for syncing and generating predictions

#### Draw Detail Page
- View all 13 matches in a draw
- See AI predictions with probabilities
- Identify spik candidates
- Manually trigger predictions or scraping for individual matches

#### Analytics
- Overall prediction accuracy
- Performance by confidence level (high/medium/low)
- Performance by predicted outcome (1/X/2)
- Scraper health metrics

#### Coupon Optimization
- Automatically generates optimal betting systems
- Identifies value bets vs crowd betting patterns
- Respects budget constraints
- Balances spiks (single bets) and garderings (multiple outcomes)

## 📚 Documentation

Complete documentation is available in the `docs/` folder:

- **[Setup Guide](docs/SETUP.md)** - Step-by-step installation and configuration
- **[Environment Variables](docs/ENV_SETUP.md)** - Detailed guide for all environment variables
- **[AI Scraper](docs/AI_SCRAPER.md)** - Hybrid AI web scraper with Claude
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Deploy to Vercel with CI/CD
- **[Database Changes](docs/DATABASE_CHANGES.md)** - Schema, migrations, and troubleshooting
- **[Scraper Guide](docs/SCRAPER_GUIDE.md)** - Web scraping implementation and anti-detection
- **[API Integration](docs/API_INTEGRATION.md)** - Svenska Spel API client usage
- **[Product Requirements](docs/PRD.md)** - Complete feature specification

## 🏗️ Project Structure

```
├── docs/                              # Complete documentation
│   ├── SETUP.md                       # Installation guide
│   ├── ENV_SETUP.md                   # Environment variables
│   ├── AI_SCRAPER.md                  # AI scraper guide
│   ├── DEPLOYMENT.md                  # Deploy to production
│   ├── DATABASE_CHANGES.md            # Database & migrations
│   ├── SCRAPER_GUIDE.md               # Web scraper docs
│   ├── API_INTEGRATION.md             # API client docs
│   └── PRD.md                         # Product requirements
├── prisma/
│   └── schema.prisma                  # Database schema
├── server/
│   ├── api/                           # API endpoints
│   ├── services/                      # Business logic
│   │   ├── svenska-spel-api.ts        # API client
│   │   ├── draw-sync.ts               # Draw syncing
│   │   ├── prediction-service.ts      # AI predictions
│   │   ├── embeddings-service.ts      # Vector embeddings
│   │   ├── coupon-optimizer.ts        # Coupon optimization
│   │   ├── performance-tracker.ts     # Performance tracking
│   │   └── scraper/                   # Web scraping system
│   ├── plugins/
│   │   └── scheduler.ts               # Background jobs
│   └── utils/
│       └── prisma.ts                  # Prisma client
├── pages/                             # Frontend pages
│   ├── index.vue                      # Dashboard
│   ├── draw/[id]/index.vue           # Draw detail
│   └── analytics.vue                  # Analytics
└── types/
    └── index.ts                       # TypeScript definitions
```

## 🔧 Available Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build

# Database
npm run db:push          # Push schema to database
npm run db:migrate       # Create new migration
npm run db:studio        # Open Prisma Studio

# Other
npm run postinstall      # Prepare Nuxt + generate Prisma client
```

## 🛡️ Anti-Detection Features

The scraper includes comprehensive measures to avoid detection:

- **Human-like behavior**: Random delays, mouse movements, scrolling
- **Browser fingerprinting**: Realistic User-Agent, viewport, headers
- **Session management**: Persistent cookies across scraping sessions
- **Rate limiting**: Maximum 1 scrape per 5-10 seconds
- **Queue system**: Spreads 13 match scrapes over 5-10 minutes
- **Error handling**: Exponential backoff, retry logic
- **Monitoring**: Tracks success/failure rates in database

## 📊 API Endpoints

### Draws
- `GET /api/draws/current` - Get current active draws
- `GET /api/draws/:drawNumber` - Get specific draw details
- `POST /api/draws/:drawNumber/optimize` - Generate optimal coupon

### Matches
- `POST /api/matches/:id/predict` - Generate prediction for a match
- `POST /api/matches/:id/scrape` - Scrape match statistics

### Admin
- `POST /api/admin/sync` - Trigger manual draw sync
- `GET /api/admin/scraper-health` - Get scraper health metrics

### Performance
- `GET /api/performance/summary` - Get prediction performance statistics

## ⏰ Background Jobs

Automated tasks run on schedule:

- **Draw Sync**: Every 6 hours
- **Performance Update**: Daily at 3 AM
- **Initial Sync**: 10 seconds after startup

## 🐛 Troubleshooting

### Scraping Issues

If scraping fails consistently:
1. Check scraper health in analytics
2. Verify Svenska Spel website hasn't changed structure
3. Increase delays in `scraper-queue.ts`
4. Check browser console for errors

### Database Issues

If database connection fails:
1. Verify DATABASE_URL in `.env`
2. Check Supabase project is active
3. Ensure pgvector extension is enabled
4. Run `npm run db:push` again

### Prediction Issues

If predictions fail:
1. Verify ANTHROPIC_API_KEY is correct
2. Check API quota/billing
3. Ensure match has scraped data
4. Check server logs for errors

## 📖 Additional Documentation

For more detailed information, see the complete documentation:

- **[AI Scraper](docs/AI_SCRAPER.md)** - Hybrid AI web scraper with Claude
- **[Database Schema & Migrations](docs/DATABASE_CHANGES.md)** - Understand the data model and migration history
- **[Web Scraping System](docs/SCRAPER_GUIDE.md)** - Learn about the scraper architecture and anti-detection
- **[API Integration](docs/API_INTEGRATION.md)** - Work with Svenska Spel's API client
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Deploy to Vercel with CI/CD setup
- **[Product Requirements](docs/PRD.md)** - Full feature specification

## 📝 Future Enhancements

Potential improvements not in current scope:

- Advanced ML models trained on historical data
- Weather integration for predictions
- Player statistics tracking
- Multiple betting strategies
- Export to various formats
- Mobile optimization
- Push notifications

## 📄 License

Private project for personal use.

## 🙏 Acknowledgments

- Svenska Spel for providing Stryktipset
- Anthropic for Claude AI
- Supabase for database hosting
- Nuxt and Vue.js teams

---

**Note**: This tool is for personal use only. Always bet responsibly.

