-- Fix match_odds unique constraint to include type field
-- This migration ensures the constraint matches the Prisma schema

-- Step 1: Drop the old 3-field constraint if it exists
-- This constraint may exist if previous migrations didn't complete properly
ALTER TABLE "match_odds" DROP CONSTRAINT IF EXISTS "match_odds_match_id_source_collected_at_key";

-- Step 2: Ensure the type column exists with default value
-- This handles cases where the column wasn't added in previous migrations
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'match_odds' AND column_name = 'type'
  ) THEN
    ALTER TABLE "match_odds" ADD COLUMN "type" VARCHAR(20) NOT NULL DEFAULT 'current';
  END IF;
END $$;

-- Step 3: Drop the new 4-field constraint if it exists (to recreate it cleanly)
ALTER TABLE "match_odds" DROP CONSTRAINT IF EXISTS "match_odds_match_id_source_type_collected_at_key";

-- Step 4: Create the correct 4-field unique constraint
ALTER TABLE "match_odds" 
ADD CONSTRAINT "match_odds_match_id_source_type_collected_at_key" 
UNIQUE ("match_id", "source", "type", "collected_at");

-- Step 5: Ensure the type index exists
CREATE INDEX IF NOT EXISTS "match_odds_type_idx" ON "match_odds"("type");

-- Step 6: Verification query (commented out - for manual verification)
-- SELECT 
--   constraint_name, 
--   constraint_type,
--   string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu 
--   ON tc.constraint_name = kcu.constraint_name
-- WHERE tc.table_name = 'match_odds' 
--   AND tc.constraint_type = 'UNIQUE'
-- GROUP BY constraint_name, constraint_type;

