# Database Changes & Migration Guide

## Current Status

**Schema Version**: 4NF (Fourth Normal Form)  
**ORM**: Prisma 7.0.1  
**Database**: PostgreSQL (Supabase) with pgvector extension  
**Last Updated**: December 1, 2024

All migrations have been successfully applied and the database is in a stable state.

## Schema Overview

### Current Schema Features

1. **Normalized to 4NF** - Eliminates data redundancy
2. **Reference Tables** - Teams, Leagues, Countries centralized
3. **Generated Columns** - Week number and year auto-computed
4. **Draw Lifecycle** - Current vs archived draws tracking
5. **Vector Support** - pgvector extension for similarity search
6. **Optimized Indexes** - Performance-tuned composite indexes

### Core Models

#### Draws
- Primary draw information
- `is_current` - Boolean flag for active draws
- `archived_at` - Timestamp when draw was archived
- Auto-generated `week_number` and `year` from `draw_date`

#### Matches
- Foreign key references to teams and leagues
- Normalized structure (removed denormalized fields)
- Auto-generated `week_number` and `year` from `start_time`

#### Teams, Leagues, Countries
- Centralized reference tables
- Single source of truth for team/league data
- Prevents duplicate and inconsistent data

#### Match Odds
- Unique constraint: `(match_id, source, type, collected_at)`
- Supports multiple odds types: current, start, favourite

#### Predictions & Performance
- AI predictions with embeddings
- Performance tracking with accuracy metrics
- Vector similarity search support

## Migration History

### ✅ Prisma 7 Upgrade (November 30, 2024)

**Changes:**
- Upgraded from Prisma 6.5.0 to 7.0.1
- Removed `url` property from schema (moved to `prisma.config.ts`)
- Created `prisma.config.ts` for configuration
- Updated all packages to compatible versions

**Benefits:**
- 90% smaller bundle size
- 3x faster query execution
- 98% fewer generated types
- Better IDE performance

**Files Changed:**
- `prisma/schema.prisma` - Removed url property
- `prisma.config.ts` - Created new config file
- `package.json` - Updated Prisma packages

### ✅ Database Normalization to 4NF (December 1, 2024)

**Migration:** `20251201_database_optimization`

**Changes:**
- Created `teams`, `countries`, `leagues` reference tables
- Migrated data from denormalized `matches` columns
- Added foreign key constraints with cascade rules
- Removed redundant columns from `matches` table
- Converted `week_number` and `year` to generated columns
- Created composite indexes for performance

**Before:**
```sql
-- Denormalized structure
matches {
  home_team TEXT
  away_team TEXT
  home_team_short TEXT
  away_team_short TEXT
  league TEXT
  country TEXT
  country_id INT
}
```

**After:**
```sql
-- Normalized structure
teams { id, name, short_name, medium_name }
countries { id, name, iso_code }
leagues { id, name, country_id }

matches {
  home_team_id INT REFERENCES teams(id)
  away_team_id INT REFERENCES teams(id)
  league_id INT REFERENCES leagues(id)
}
```

**Benefits:**
- Data consistency (no more "Liverpool" vs "Liverpool FC")
- Single source of truth
- Foreign key integrity
- Smaller matches table (7 fewer columns)
- Team-level statistics now possible

**Files Changed:**
- `prisma/schema.prisma` - Complete schema overhaul
- 10 code files updated to use new relations

### ✅ Draw Lifecycle Tracking (December 1, 2024)

**Migration:** `20251201_add_draw_lifecycle`

**Changes:**
- Added `is_current` boolean to `draws` table
- Added `archived_at` timestamp to `draws` table
- Created index on `is_current` for efficient filtering
- Auto-archived existing completed draws

**Purpose:**
- Distinguish current draws from historical ones
- Optimize scraper URL pattern selection
- Support accessibility tree-based scraping

**Usage:**
```typescript
// Check if draw should be archived
const status = await drawLifecycle.shouldArchive(drawNumber)

// Archive a draw
await drawLifecycle.archiveDraw(drawNumber)

// Get current draws
const draws = await prisma.draws.findMany({
  where: { is_current: true }
})
```

### ✅ Match Odds Constraint Fix (December 1, 2024)

**Migration:** `20251201005321_fix_match_odds_constraint`

**Problem:**
- Old constraint: `(match_id, source, collected_at)`
- Caused conflicts when storing multiple odds types

**Solution:**
- Correct constraint: `(match_id, source, type, collected_at)`
- Added defensive timestamp offsets (1ms, 2ms) for different odds types

**Impact:**
- No more "Unique constraint failed" errors
- All odds types (current, start, favourite) stored successfully

## How to Apply Migrations

### For Development

If you need to apply migrations locally:

```bash
# Apply all pending migrations
npx prisma migrate deploy

# Or if in development mode (creates migration if needed)
npx prisma migrate dev
```

### For Production (Vercel)

Migrations are automatically applied on deployment:

1. `git push` triggers Vercel build
2. Vercel runs `npx prisma generate`
3. Vercel runs `npx prisma migrate deploy`
4. Application deploys with updated schema

### Manual Migration (Supabase SQL Editor)

If `prisma migrate` times out, you can apply migrations manually:

1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Open the migration SQL file from `prisma/migrations/[migration_name]/migration.sql`
4. Copy and paste the SQL
5. Click "Run"

**Manual migration files available:**
- `prisma/migrations/manual/draw_lifecycle.sql` - Add draw lifecycle fields

## Database Schema Reference

### Key Relations

```typescript
// Accessing related data
match.homeTeam.name           // Home team name
match.awayTeam.name           // Away team name
match.league.name             // League name
match.league.country.name     // Country name
prediction.match.outcome      // Match outcome from prediction

// Common queries
const matches = await prisma.matches.findMany({
  include: {
    homeTeam: true,
    awayTeam: true,
    league: {
      include: { country: true }
    }
  }
})
```

### Important: Relation Names

Prisma uses camelCase for relations:

✅ **Correct:**
```typescript
match.homeTeam      // Relation (camelCase)
match.awayTeam      // Relation (camelCase)
match.home_team_id  // Foreign key (snake_case)
```

❌ **Incorrect:**
```typescript
match.home_team     // This doesn't exist anymore
match.away_team     // This doesn't exist anymore
```

### Indexes

Optimized composite indexes for common queries:

- `matches(home_team_id, away_team_id)` - Head-to-head queries
- `matches(league_id, start_time)` - League-based queries
- `match_odds(match_id, type)` - Odds type filtering
- `predictions(match_id, created_at DESC)` - Latest prediction queries
- `draws(is_current)` - Current draws filtering

## Troubleshooting

### "Column does not exist" Error

**Symptom:** Error mentioning `is_current` or `archived_at` doesn't exist

**Solution:**
```bash
# Apply the draw lifecycle migration
npx prisma migrate deploy

# Or run manual SQL in Supabase
# See: prisma/migrations/manual/draw_lifecycle.sql
```

### Type Errors After Schema Changes

**Symptom:** TypeScript errors about missing properties

**Solution:**
```bash
# Regenerate Prisma Client
npx prisma generate

# Restart dev server
npm run dev
```

### Foreign Key Constraint Violations

**Symptom:** Cannot insert match due to missing team/league

**Solution:**
The draw sync service automatically creates teams/leagues/countries before matches. If you're inserting data manually, ensure reference data exists first:

```typescript
// Upsert team before creating match
const team = await prisma.teams.upsert({
  where: { name: "Liverpool" },
  create: { name: "Liverpool", short_name: "LIV" },
  update: {}
})
```

### Migration Fails with Timeout

**Symptom:** `prisma migrate deploy` times out

**Solutions:**
1. Use manual SQL migration (see above)
2. Check Supabase connection string
3. Verify database is accessible
4. Run during off-peak hours

### Schema Drift

**Symptom:** Warning about schema drift between database and migrations

**Solution:**
```bash
# In development, reset and reapply
npx prisma migrate reset

# In production, never reset - investigate and create new migration
npx prisma migrate dev --create-only
```

## Validation Queries

### Verify Schema

```sql
-- Check draws table has lifecycle fields
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'draws' 
  AND column_name IN ('is_current', 'archived_at');

-- Check reference tables exist and have data
SELECT COUNT(*) FROM teams;
SELECT COUNT(*) FROM leagues;
SELECT COUNT(*) FROM countries;

-- Verify match_odds constraint
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'match_odds' 
  AND constraint_type = 'UNIQUE';
-- Should show: match_odds_match_id_source_type_collected_at_key
```

### Check Data Integrity

```sql
-- Verify all matches have valid team references
SELECT COUNT(*) 
FROM matches 
WHERE home_team_id NOT IN (SELECT id FROM teams)
   OR away_team_id NOT IN (SELECT id FROM teams);
-- Should be 0

-- Check current vs archived draws
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN is_current THEN 1 ELSE 0 END) as current,
  SUM(CASE WHEN NOT is_current THEN 1 ELSE 0 END) as archived
FROM draws;
```

## Best Practices

### When Creating Migrations

1. **Always backup** before running migrations in production
2. **Test locally** first with production data copy
3. **Use transactions** for data migrations
4. **Add validation** queries to verify success
5. **Document changes** in migration README files

### When Modifying Schema

1. **Run `npx prisma generate`** after schema changes
2. **Update code** to match new relation names
3. **Update API responses** if data structure changes
4. **Test endpoints** that query affected tables
5. **Check frontend** displays data correctly

### Performance Considerations

1. **Use indexes** for frequently queried columns
2. **Include related data** with `include` to avoid N+1 queries
3. **Select only needed fields** to reduce data transfer
4. **Use composite indexes** for multi-column filters
5. **Monitor slow queries** in production logs

## Additional Resources

- **Prisma Documentation**: https://www.prisma.io/docs
- **Prisma 7 Upgrade Guide**: https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions
- **PostgreSQL Indexes**: https://www.postgresql.org/docs/current/indexes.html
- **Database Normalization**: https://en.wikipedia.org/wiki/Database_normalization

## Need Help?

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review migration files in `prisma/migrations/`
3. Check Prisma schema in `prisma/schema.prisma`
4. Verify environment variables in `.env`
5. Check Supabase dashboard for connection issues
