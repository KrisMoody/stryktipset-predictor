-- Database Optimization Migration
-- Normalize database structure by extracting teams, leagues, and countries into separate tables
-- This migration creates reference tables and migrates existing data

-- Step 1: Create new reference tables

-- Countries table
CREATE TABLE IF NOT EXISTS "countries" (
  "id" INTEGER NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "iso_code" VARCHAR(3),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "countries_name_key" ON "countries"("name");

-- Leagues table
CREATE TABLE IF NOT EXISTS "leagues" (
  "id" INTEGER NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "country_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leagues_country_id_idx" ON "leagues"("country_id");

-- Teams table
CREATE TABLE IF NOT EXISTS "teams" (
  "id" INTEGER NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "short_name" VARCHAR(50),
  "medium_name" VARCHAR(50),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "teams_name_key" ON "teams"("name");

-- Step 2: Migrate existing data to new reference tables

-- Migrate countries from matches table
INSERT INTO "countries" ("id", "name", "iso_code", "created_at", "updated_at")
SELECT DISTINCT 
  country_id,
  country,
  NULL as iso_code,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "matches"
WHERE country_id IS NOT NULL 
  AND country IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "countries" WHERE "countries"."id" = "matches"."country_id"
  )
ON CONFLICT ("id") DO NOTHING;

-- Migrate leagues from matches table
INSERT INTO "leagues" ("id", "name", "country_id", "created_at", "updated_at")
SELECT DISTINCT 
  m.league_id,
  m.league,
  COALESCE(m.country_id, 0) as country_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "matches" m
WHERE m.league_id IS NOT NULL 
  AND m.league IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "leagues" WHERE "leagues"."id" = m."league_id"
  )
ON CONFLICT ("id") DO NOTHING;

-- Migrate home teams from matches table
INSERT INTO "teams" ("id", "name", "short_name", "medium_name", "created_at", "updated_at")
SELECT DISTINCT 
  home_team_id,
  home_team,
  home_team_short,
  NULL as medium_name,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "matches"
WHERE home_team_id IS NOT NULL 
  AND home_team IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "teams" WHERE "teams"."id" = "matches"."home_team_id"
  )
ON CONFLICT ("id") DO NOTHING;

-- Migrate away teams from matches table
INSERT INTO "teams" ("id", "name", "short_name", "medium_name", "created_at", "updated_at")
SELECT DISTINCT 
  away_team_id,
  away_team,
  away_team_short,
  NULL as medium_name,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "matches"
WHERE away_team_id IS NOT NULL 
  AND away_team IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "teams" WHERE "teams"."id" = "matches"."away_team_id"
  )
ON CONFLICT ("id") DO NOTHING;

-- Step 3: Add foreign key constraints to leagues table
ALTER TABLE "leagues" 
  ADD CONSTRAINT "leagues_country_id_fkey" 
  FOREIGN KEY ("country_id") 
  REFERENCES "countries"("id") 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- Step 4: Verify data integrity before modifying matches table
-- Check that all matches have valid team and league references
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  -- Check for matches without valid home_team_id
  SELECT COUNT(*) INTO invalid_count
  FROM "matches"
  WHERE home_team_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM "teams" WHERE "teams"."id" = "matches"."home_team_id"
  );
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % matches with invalid home_team_id', invalid_count;
  END IF;

  -- Check for matches without valid away_team_id
  SELECT COUNT(*) INTO invalid_count
  FROM "matches"
  WHERE away_team_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM "teams" WHERE "teams"."id" = "matches"."away_team_id"
  );
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % matches with invalid away_team_id', invalid_count;
  END IF;

  -- Check for matches without valid league_id
  SELECT COUNT(*) INTO invalid_count
  FROM "matches"
  WHERE league_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM "leagues" WHERE "leagues"."id" = "matches"."league_id"
  );
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % matches with invalid league_id', invalid_count;
  END IF;
END $$;

-- Step 5: Drop old indexes on columns we're about to remove
DROP INDEX IF EXISTS "matches_home_team_idx";
DROP INDEX IF EXISTS "matches_away_team_idx";

-- Step 6: Make team and league IDs non-nullable in matches table
ALTER TABLE "matches" ALTER COLUMN "home_team_id" SET NOT NULL;
ALTER TABLE "matches" ALTER COLUMN "away_team_id" SET NOT NULL;
ALTER TABLE "matches" ALTER COLUMN "league_id" SET NOT NULL;

-- Step 7: Add foreign key constraints to matches table
ALTER TABLE "matches" 
  ADD CONSTRAINT "matches_home_team_id_fkey" 
  FOREIGN KEY ("home_team_id") 
  REFERENCES "teams"("id") 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

ALTER TABLE "matches" 
  ADD CONSTRAINT "matches_away_team_id_fkey" 
  FOREIGN KEY ("away_team_id") 
  REFERENCES "teams"("id") 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

ALTER TABLE "matches" 
  ADD CONSTRAINT "matches_league_id_fkey" 
  FOREIGN KEY ("league_id") 
  REFERENCES "leagues"("id") 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- Step 8: Add new optimized indexes to matches table
CREATE INDEX IF NOT EXISTS "matches_home_team_id_idx" ON "matches"("home_team_id");
CREATE INDEX IF NOT EXISTS "matches_away_team_id_idx" ON "matches"("away_team_id");
CREATE INDEX IF NOT EXISTS "matches_league_id_idx" ON "matches"("league_id");
CREATE INDEX IF NOT EXISTS "matches_home_team_id_away_team_id_idx" ON "matches"("home_team_id", "away_team_id");
CREATE INDEX IF NOT EXISTS "matches_league_id_start_time_idx" ON "matches"("league_id", "start_time");

-- Step 9: Add composite index to match_odds for common query pattern
CREATE INDEX IF NOT EXISTS "match_odds_match_id_type_idx" ON "match_odds"("match_id", "type");

-- Step 10: Add composite index to predictions for latest prediction queries
CREATE INDEX IF NOT EXISTS "predictions_match_id_created_at_idx" ON "predictions"("match_id", "created_at" DESC);

-- Step 11: Drop denormalized columns from matches table
ALTER TABLE "matches" DROP COLUMN IF EXISTS "home_team";
ALTER TABLE "matches" DROP COLUMN IF EXISTS "away_team";
ALTER TABLE "matches" DROP COLUMN IF EXISTS "home_team_short";
ALTER TABLE "matches" DROP COLUMN IF EXISTS "away_team_short";
ALTER TABLE "matches" DROP COLUMN IF EXISTS "league";
ALTER TABLE "matches" DROP COLUMN IF EXISTS "country";
ALTER TABLE "matches" DROP COLUMN IF EXISTS "country_id";

-- Step 12: Convert computed columns in draws table to generated columns
-- First, drop the existing columns
ALTER TABLE "draws" DROP COLUMN IF EXISTS "week_number";
ALTER TABLE "draws" DROP COLUMN IF EXISTS "year";

-- Add them back as generated columns
ALTER TABLE "draws" ADD COLUMN "week_number" INTEGER GENERATED ALWAYS AS (EXTRACT(WEEK FROM "draw_date")::INTEGER) STORED;
ALTER TABLE "draws" ADD COLUMN "year" INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM "draw_date")::INTEGER) STORED;

-- Step 13: Add indexes on generated columns for queries
CREATE INDEX IF NOT EXISTS "draws_year_idx" ON "draws"("year");
CREATE INDEX IF NOT EXISTS "draws_week_number_idx" ON "draws"("week_number");

-- Migration complete

