# Design: Eliminate Unnecessary `any` Types

## Context

The codebase uses `: any` in 138 places across production code. This reduces type safety and IDE support. The main challenge is that scraped data from `match_scraped_data` has different shapes based on `data_type`, requiring a discriminated union pattern.

**Reference Documentation:**
- API-Football response structures: [docs/API-FOOTBALL-Complete-Documentation.md](../../docs/API-FOOTBALL-Complete-Documentation.md)
- Svenska Spel API types: Already defined in `types/index.ts`

## Goals

- Reduce `any` usage by 60%+ in production code
- Maintain flexibility for external API extensibility
- Improve developer experience with better autocomplete
- Enable future strict TypeScript rules

## Non-Goals

- Perfect type coverage (100% elimination)
- Typing test mocks and fixtures
- Changing runtime behavior

## Decision 1: Discriminated Union for Scraped Data

### Problem
```typescript
// Current: no type narrowing
const xStats = match.match_scraped_data?.find((d: any) => d.data_type === 'xStats')
// xStats.data is `any`
```

### Solution: Discriminated Union + Type Guards

```typescript
// types/scraped-data.ts

interface BaseScrapedData {
  id: number
  match_id: number
  scraped_at: Date
}

interface XStatsScrapedData extends BaseScrapedData {
  data_type: 'xStats'
  data: XStatsData
}

interface StatisticsScrapedData extends BaseScrapedData {
  data_type: 'statistics'
  data: StatisticsData
}

interface LineupScrapedData extends BaseScrapedData {
  data_type: 'lineup'
  data: LineupData
}

// ... other types

type ScrapedDataEntry =
  | XStatsScrapedData
  | StatisticsScrapedData
  | LineupScrapedData
  | HeadToHeadScrapedData
  | NewsScrapedData
  | InjuriesScrapedData
  | MarketOddsScrapedData
  | APIPredictionsScrapedData
  | TeamSeasonStatsScrapedData
  | StandingsScrapedData
  | APILineupsScrapedData

// Type guard helper
function isDataType<T extends ScrapedDataEntry['data_type']>(
  entry: ScrapedDataEntry,
  type: T
): entry is Extract<ScrapedDataEntry, { data_type: T }> {
  return entry.data_type === type
}
```

### Usage After Change
```typescript
// Typed accessor
function getScrapedData<T extends ScrapedDataEntry['data_type']>(
  match: MatchWithScrapedData,
  type: T
): Extract<ScrapedDataEntry, { data_type: T }>['data'] | null {
  const entry = match.match_scraped_data?.find(d => d.data_type === type)
  return entry?.data ?? null
}

// Usage
const xStats = getScrapedData(match, 'xStats')
// xStats is now typed as XStatsData | null
```

### Alternatives Considered

1. **Keep `any` with inline type assertions**
   - Rejected: Doesn't prevent accessing wrong properties

2. **Generic wrapper with manual casting**
   - Rejected: Still requires unsafe casts

3. **Zod runtime validation**
   - Considered: Good for external data, but overkill for internal structures

## Decision 2: Playwright `Page` Type

Import from `playwright` or `playwright-core`:

```typescript
import type { Page } from 'playwright'

private async scrapeTab(
  page: Page,  // Instead of any
  dataType: string
): Promise<{ data: T | null; ... }> {
```

## Decision 3: Prisma Result Types

Use `Prisma.` namespace or infer from query:

```typescript
// Option A: Use Prisma types
import { Prisma } from '@prisma/client'
type FailedGameRecord = Prisma.failed_gamesGetPayload<{}>

// Option B: Infer from query
const result = await prisma.failed_games.findMany({ where: {...} })
type FailedGameRecord = typeof result[number]
```

## Decision 4: API-Football Response Types

Create types based on the documented API response structures in [docs/API-FOOTBALL-Complete-Documentation.md](../../docs/API-FOOTBALL-Complete-Documentation.md).

### Example: Fixtures Response Type
```typescript
// types/api-football.ts

interface APIFootballFixture {
  fixture: {
    id: number
    referee: string | null
    timezone: string
    date: string
    timestamp: number
    periods: { first: number | null; second: number | null }
    venue: { id: number | null; name: string | null; city: string | null }
    status: { long: string; short: string; elapsed: number | null; extra: number | null }
  }
  league: {
    id: number
    name: string
    country: string
    logo: string
    flag: string | null
    season: number
    round: string
  }
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null }
    away: { id: number; name: string; logo: string; winner: boolean | null }
  }
  goals: { home: number | null; away: number | null }
  score: {
    halftime: { home: number | null; away: number | null }
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

interface APIFootballPrediction {
  predictions: {
    winner: { id: number; name: string; comment: string }
    win_or_draw: boolean
    under_over: string | null
    goals: { home: string; away: string }
    advice: string
    percent: { home: string; draw: string; away: string }
  }
  // ... etc from docs
}
```

## Decision 5: Index Signatures (Keep)

The `[key: string]: any` in type definitions is intentional for API extensibility:

```typescript
export interface DrawData {
  productName: string
  drawNumber: number
  // ... known fields
  [key: string]: any  // Future API fields we don't know about
}
```

This is acceptable because:
1. External APIs may add fields without notice
2. We want to preserve unknown data for debugging
3. The known fields are still typed

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Breaking runtime if types wrong | Add runtime checks at API boundaries |
| Increased verbosity | Helper functions reduce boilerplate |
| Learning curve | Well-documented types are easier than untyped |

## Migration Plan

1. Create new types in `types/scraped-data.ts`
2. Add accessor functions to a utility file
3. Migrate services one file at a time
4. Each migration is a separate PR for easy review
5. Rollback: Revert individual commits if needed

## Open Questions

1. Should we add Zod validation for external API responses?
   - Defer: Separate concern, would add dependencies

2. Should we type test files too?
   - Defer: Lower priority, optional follow-up
