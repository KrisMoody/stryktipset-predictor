# AGENTS.md - AI Assistant Context

This file provides context for AI assistants working on this codebase.

## Project Overview

**st-predictor** is a Nuxt 4 application for Swedish Stryktipset football betting predictions. It fetches match data from Svenska Spel API, generates AI-powered predictions using Claude/OpenAI, and provides betting system optimization (R-systems, U-systems) with coupon generation.

## Tech Stack

- **Framework**: Nuxt 4.0.0 with TypeScript (strict mode)
- **Vue**: 3.5.13
- **UI**: @nuxt/ui 4.0.1, @nuxt/icon 2.1.0
- **Database**: PostgreSQL via Prisma 7.1.0 (Supabase hosted with pgvector extension)
- **Auth**: @nuxtjs/supabase 2.0.3 for authentication
- **AI**: Anthropic SDK 0.71.2, OpenAI SDK 6.10.0
- **Testing**: Vitest 4.0.15 (unit/component/API) + Playwright 1.57.0 (e2e/a11y)
- **Linting**: ESLint 9.0.0 + Prettier 3.7.4
- **Task Scheduling**: Croner 9.1.0
- **Package Manager**: Yarn (yarn.lock present)

## Project Structure

```
├── components/          # Vue components (21 files)
│   ├── ai-metrics/      # AI cost/usage monitoring components
│   ├── match/           # Match analysis components (AIAnalysis, HeadToHead, etc.)
│   └── optimize/        # Coupon optimization components
├── composables/         # Vue composables
├── docs/                # Project documentation
├── layouts/             # Nuxt layouts
├── pages/               # Nuxt pages (9 routes)
│   ├── index.vue        # Home/dashboard
│   ├── draw/[id]/       # Draw details and optimization
│   ├── admin.vue        # Admin panel
│   ├── ai-dashboard.vue # AI metrics dashboard
│   ├── analytics.vue    # Analytics page
│   └── performance.vue  # Performance tracking
├── plugins/             # Nuxt plugins
├── prisma/              # Database schema (14 models)
├── scripts/             # Utility scripts (backfill, etc.)
├── server/              # Server-side code
│   ├── api/             # API routes (30+ endpoints)
│   ├── constants/       # Server constants
│   ├── plugins/         # Server plugins
│   ├── services/        # Business logic (18 services)
│   └── utils/           # Server utilities
├── services/            # External services (AI scraper - Python)
├── supabase/            # Supabase configuration
├── tests/               # Test files
│   ├── api/             # API tests
│   ├── components/      # Component tests
│   ├── e2e/             # Playwright e2e tests
│   ├── accessibility/   # A11y tests
│   └── unit/            # Unit tests
├── types/               # TypeScript type definitions
└── utils/               # Shared utilities
```

## Key Database Models

- `draws` - Stryktipset rounds/coupons
- `matches` - Individual matches in draws
- `predictions` - AI-generated predictions with confidence/reasoning
- `match_odds` - Odds data from multiple sources
- `match_scraped_data` - Additional scraped statistics
- `ai_usage` - AI cost tracking
- `system_performance` - R/U betting system performance
- `generated_coupons` - Saved coupon configurations
- `prediction_batches` - Anthropic Batch API requests

## Key Services

- `prediction-service.ts` - AI prediction generation
- `coupon-optimizer.ts` / `coupon-optimizer-v2.ts` - Betting optimization
- `system-generator.ts` - R/U system generation
- `svenska-spel-api.ts` - Svenska Spel API integration
- `draw-sync.ts` - Data synchronization
- `ai-metrics-service.ts` - Cost monitoring
- `embeddings-service.ts` - Vector embeddings for similarity search

## Key Configuration

- **Runtime Config**: API keys and URLs in `nuxt.config.ts` under `runtimeConfig`
- **Environment Variables**: See `.env.example` for full list
- **Required**: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- **Optional**: `ALLOWED_EMAILS` (auth whitelist), scraper configuration

## Development Commands

```bash
yarn dev              # Start development server
yarn build            # Build for production
yarn lint             # Run ESLint
yarn format:check     # Check Prettier formatting
yarn typecheck        # TypeScript type checking (nuxt typecheck)
yarn test             # Run Vitest in watch mode
yarn test:unit        # Run unit tests
yarn test:components  # Run component tests
yarn test:api         # Run API tests
yarn test:e2e         # Run Playwright e2e tests
yarn test:a11y        # Run accessibility tests
yarn test:all         # Run all tests (Vitest + Playwright)
yarn db:studio        # Open Prisma Studio
yarn db:migrate       # Run database migrations
```

## Important Documentation

- [docs/PRD.md](docs/PRD.md) - Product Requirements Document
- [docs/SETUP.md](docs/SETUP.md) - Setup instructions
- [docs/AI_SCRAPER.md](docs/AI_SCRAPER.md) - AI scraper documentation
- [docs/SCRAPER_GUIDE.md](docs/SCRAPER_GUIDE.md) - Scraper usage guide
- [docs/API_INTEGRATION.md](docs/API_INTEGRATION.md) - API integration details
- [docs/DATABASE_CHANGES.md](docs/DATABASE_CHANGES.md) - Database schema documentation

## Coding Standards

1. **TypeScript**: Strict mode enabled - all code must be properly typed
2. **Linting**: ESLint + Prettier - run `yarn lint` before committing
3. **Components**: Use Vue 3 Composition API with `<script setup>`
4. **Testing**: Write tests for new features in `tests/` directory
5. **Git Hooks**: Husky + lint-staged configured for pre-commit checks

## AI Scraper

The project includes a Python-based AI scraper in `services/ai-scraper/`. This is excluded from Vite's file watching to avoid conflicts. Start with `yarn dev:ai` or use `yarn dev:all` for both. See [docs/AI_SCRAPER.md](docs/AI_SCRAPER.md) for details.

## Notes for AI Assistants

- Always run type checking (`yarn typecheck`) after making TypeScript changes
- Use Prisma client for all database operations
- Server-side API keys are in `runtimeConfig`, not `runtimeConfig.public`
- The Svenska Spel API is the primary data source for match information
- AI usage is tracked in `ai_usage` table - always record costs
- The app uses Supabase for auth only, Prisma for all database operations
- pgvector extension is enabled for similarity search features
- Deployment is configured for Vercel (see `vercel.json`)
