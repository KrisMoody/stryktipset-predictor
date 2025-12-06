# Database Optimization Migration

## Overview

This migration normalizes the database from 3NF to 4NF by extracting teams, leagues, and countries into separate reference tables. This eliminates data redundancy and enables team-level analytics.

## What Changed

### New Tables

1. **`teams`** - Team reference data
   - Stores unique teams with their IDs from Svenska Spel API
   - Fields: `id`, `name`, `short_name`, `medium_name`

2. **`countries`** - Country reference data
   - Stores unique countries with their IDs
   - Fields: `id`, `name`, `iso_code`

3. **`leagues`** - League/competition reference data
   - Stores unique leagues with country associations
   - Fields: `id`, `name`, `country_id`

### Modified Tables

**`matches`** - Updated to use foreign keys instead of denormalized data
- **Removed**: `home_team`, `away_team`, `home_team_short`, `away_team_short`, `league`, `country`, `country_id`
- **Changed**: `home_team_id`, `away_team_id`, `league_id` now required with FK constraints
- **Added**: Composite indexes for common query patterns

**`draws`** - Converted computed fields to generated columns
- `week_number` and `year` now auto-generated from `draw_date`

### Index Optimizations

**New Composite Indexes:**
- `matches(home_team_id, away_team_id)` - for head-to-head lookups
- `matches(league_id, start_time)` - for league-specific queries
- `match_odds(match_id, type)` - for fetching specific odds types
- `predictions(match_id, created_at DESC)` - for latest predictions

## Running the Migration

### Prerequisites

1. **Backup your database**:
   ```bash
   pg_dump your_database > backup_before_optimization.sql
   ```

2. **Ensure no active connections** to the database during migration

### Steps

1. **Generate Prisma Client** with new schema:
   ```bash
   npx prisma generate
   ```

2. **Run the migration**:
   ```bash
   npx prisma migrate deploy
   ```

3. **Validate the migration**:
   ```bash
   psql your_database < prisma/migrations/20251201_database_optimization/validate.sql
   ```

4. **Test the application**:
   ```bash
   # Start dev server
   npm run dev
   
   # Test key endpoints
   curl http://localhost:3000/api/draws/current
   ```

## Rollback (if needed)

If you need to rollback, restore from backup:

```bash
psql your_database < backup_before_optimization.sql
```

Then revert the code changes:
```bash
git revert HEAD
```

## Validation Checklist

After migration, verify:

- [ ] All reference tables populated (teams, leagues, countries)
- [ ] No matches with invalid foreign keys
- [ ] Generated columns working (week_number, year)
- [ ] All indexes created successfully
- [ ] Frontend displays team/league names correctly
- [ ] API endpoints return proper data
- [ ] Predictions service works
- [ ] Draw sync from Svenska Spel API works

## Performance Impact

**Expected Improvements:**
- Smaller matches table (fewer columns)
- Faster team-based queries (indexed foreign keys)
- Consistent team naming (no duplicates)

**Query Changes:**
- Most queries now require 2-3 JOINs to get team/league names
- Properly indexed, these JOINs should have minimal overhead
- Complex queries benefit from composite indexes

## Code Changes Required

All code changes have been made to:

- ✅ `prisma/schema.prisma` - Schema updates
- ✅ `server/services/draw-sync.ts` - Upsert teams/leagues before matches
- ✅ `server/services/embeddings-service.ts` - Updated queries with JOINs
- ✅ `server/services/prediction-service.ts` - Updated match includes
- ✅ `server/api/draws/[drawNumber]/index.get.ts` - Added relation includes
- ✅ `server/api/draws/current.get.ts` - Added relation includes
- ✅ `pages/draw/[id]/index.vue` - Updated to access nested team/league objects
- ✅ `types/index.ts` - Added Team, Country, League interfaces

## Benefits

1. **Data Consistency**
   - Team names standardized across all matches
   - No duplicate team/league records
   - Easier to fix data quality issues

2. **New Capabilities**
   - Team-level statistics and analytics
   - League-level aggregations
   - Historical team performance tracking
   - Better similar match detection

3. **Data Integrity**
   - Foreign key constraints prevent orphaned records
   - Cascade deletes maintain referential integrity
   - Database enforces valid references

4. **Query Performance**
   - Optimized composite indexes for common patterns
   - Generated columns reduce computation
   - Efficient team head-to-head lookups

## Troubleshooting

### Migration fails with "invalid foreign key"

**Cause**: Existing matches reference teams/leagues not in API response

**Solution**: Check which matches have invalid references:
```sql
SELECT * FROM matches 
WHERE home_team_id IS NULL 
   OR away_team_id IS NULL 
   OR league_id IS NULL;
```

Manually create missing teams/leagues or delete invalid matches.

### Frontend shows "undefined" for team names

**Cause**: API endpoint not including team relations

**Solution**: Ensure all match queries include:
```typescript
include: {
  home_team: true,
  away_team: true,
  league: {
    include: { country: true }
  }
}
```

### Slow queries after migration

**Cause**: Missing indexes or query not using indexes

**Solution**: Run EXPLAIN ANALYZE on slow queries:
```sql
EXPLAIN ANALYZE
SELECT * FROM matches m
JOIN teams ht ON m.home_team_id = ht.id
WHERE ht.name = 'Liverpool';
```

Check if indexes are being used. May need additional indexes for specific queries.

## Support

For issues or questions about this migration:
1. Check the validation script results
2. Review the code changes in this migration
3. Consult the main README for project setup

## Migration Details

- **Date**: December 1, 2024
- **Type**: Schema normalization (3NF → 4NF)
- **Reversible**: Via database backup restoration
- **Breaking Changes**: Yes (schema structure changed)
- **Data Loss**: No (all data migrated)

