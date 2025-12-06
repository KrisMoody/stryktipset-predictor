-- Add new columns to matches table
ALTER TABLE "matches" 
ADD COLUMN IF NOT EXISTS "home_team_short" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "away_team_short" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "status_time" TIMESTAMP(6),
ADD COLUMN IF NOT EXISTS "coverage" INTEGER,
ADD COLUMN IF NOT EXISTS "betRadar_id" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "kambi_id" VARCHAR(100);

-- Add new indexes for matches
CREATE INDEX IF NOT EXISTS "matches_betRadar_id_idx" ON "matches"("betRadar_id");
CREATE INDEX IF NOT EXISTS "matches_kambi_id_idx" ON "matches"("kambi_id");

-- Add type column to match_odds table (default to 'current' for existing records)
ALTER TABLE "match_odds" 
ADD COLUMN IF NOT EXISTS "type" VARCHAR(20) NOT NULL DEFAULT 'current';

-- Add expert tips columns to match_odds table
ALTER TABLE "match_odds" 
ADD COLUMN IF NOT EXISTS "tio_tidningars_tips_home" VARCHAR(10),
ADD COLUMN IF NOT EXISTS "tio_tidningars_tips_draw" VARCHAR(10),
ADD COLUMN IF NOT EXISTS "tio_tidningars_tips_away" VARCHAR(10);

-- Drop old unique constraint
ALTER TABLE "match_odds" DROP CONSTRAINT IF EXISTS "match_odds_match_id_source_collected_at_key";

-- Add new unique constraint with type
ALTER TABLE "match_odds" ADD CONSTRAINT "match_odds_match_id_source_type_collected_at_key" 
UNIQUE ("match_id", "source", "type", "collected_at");

-- Add new index for type
CREATE INDEX IF NOT EXISTS "match_odds_type_idx" ON "match_odds"("type");

