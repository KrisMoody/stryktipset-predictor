# Integration Tests

Integration tests run against a real database and external services.

## Important Notes

- These tests are **non-blocking** in CI (`continue-on-error: true`)
- They require a running PostgreSQL database with pgvector extension
- External API failures won't prevent deployment

## Running Locally

```bash
# Ensure database is running
docker-compose up -d postgres

# Run integration tests
npm run test:integration
```

## Test Coverage

Integration tests should cover:
- Real database queries with Prisma
- API endpoints with real data
- Supabase realtime subscriptions
- Full optimization flow (sync → predict → optimize)

## Adding Tests

Create test files following the pattern: `*.test.ts`

Example:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'

describe('Database Integration', () => {
  beforeAll(async () => {
    // Setup test data
  })

  afterAll(async () => {
    // Cleanup test data
    await prisma.$disconnect()
  })

  it('queries draws from database', async () => {
    const draws = await prisma.draws.findMany({ take: 5 })
    expect(Array.isArray(draws)).toBe(true)
  })
})
```
