# AGENTS.md - AI Assistant Context

This file provides context for AI assistants working on this codebase.

## Project Overview

**st-predictor** is a Nuxt 3 application for Swedish Stryktipset football betting predictions. It scrapes match data, integrates with external APIs, and provides a UI for viewing predictions.

## Tech Stack

- **Framework**: Nuxt 3 with TypeScript (strict mode)
- **UI**: Nuxt UI + Nuxt Icon
- **Database**: PostgreSQL via Prisma ORM (Supabase hosted)
- **Testing**: Vitest (unit) + Playwright (e2e)
- **Linting**: ESLint with stylistic config
- **Package Manager**: npm (package-lock.json present)

## Project Structure

```
├── components/     # Vue components
├── composables/    # Vue composables
├── docs/           # Project documentation
├── layouts/        # Nuxt layouts
├── pages/          # Nuxt pages (file-based routing)
├── plugins/        # Nuxt plugins
├── prisma/         # Database schema and migrations
├── scripts/        # Utility scripts
├── server/         # Server-side code
│   ├── api/        # API routes
│   ├── plugins/    # Server plugins
│   ├── services/   # Business logic services
│   └── utils/      # Server utilities
├── services/       # External services (AI scraper)
├── tests/          # Test files
├── types/          # TypeScript type definitions
└── utils/          # Shared utilities
```

## Key Configuration

- **Runtime Config**: API keys and URLs are in `nuxt.config.ts` under `runtimeConfig`
- **Environment**: See `.env.example` for required environment variables
- **Database URL**: `DATABASE_URL` for Prisma connection
- **External APIs**: Svenska Spel API, Anthropic API, OpenAI API

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run test:unit    # Run Vitest unit tests
npm test             # Run all tests
npx nuxi typecheck   # TypeScript type checking
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
2. **Linting**: ESLint with stylistic rules - run `npm run lint` before committing
3. **Components**: Use Vue 3 Composition API with `<script setup>`
4. **Testing**: Write tests for new features in `tests/` directory

## AI Scraper

The project includes a Python-based AI scraper in `services/ai-scraper/`. This is excluded from Vite's file watching to avoid conflicts. See [docs/AI_SCRAPER.md](docs/AI_SCRAPER.md) for details.

## Notes for AI Assistants

- Always run type checking (`npx nuxi typecheck`) after making TypeScript changes
- Use Prisma client for all database operations
- Server-side API keys are in `runtimeConfig`, not `runtimeConfig.public`
- The Svenska Spel API is the primary data source for match information
