-- API-Football Integration Tables
-- Migration: add_api_football_integration

-- Team mappings between Svenska Spel and API-Football
CREATE TABLE IF NOT EXISTS "team_mappings" (
    "id" SERIAL PRIMARY KEY,
    "svenska_spel_team_id" INTEGER NOT NULL UNIQUE,
    "api_football_team_id" INTEGER NOT NULL,
    "confidence" VARCHAR(10) NOT NULL,
    "match_method" VARCHAR(50) NOT NULL,
    "similarity" DECIMAL(5, 2),
    "betradar_id" VARCHAR(100),
    "kambi_id" VARCHAR(100),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" VARCHAR(255),
    "verified_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_mappings_svenska_spel_team_id_fkey" FOREIGN KEY ("svenska_spel_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "team_mappings_api_football_team_id_idx" ON "team_mappings"("api_football_team_id");
CREATE INDEX IF NOT EXISTS "team_mappings_confidence_idx" ON "team_mappings"("confidence");
CREATE INDEX IF NOT EXISTS "team_mappings_verified_idx" ON "team_mappings"("verified");

-- League mappings between Svenska Spel and API-Football
CREATE TABLE IF NOT EXISTS "league_mappings" (
    "id" SERIAL PRIMARY KEY,
    "svenska_spel_league_id" INTEGER NOT NULL UNIQUE,
    "api_football_league_id" INTEGER NOT NULL,
    "confidence" VARCHAR(10) NOT NULL,
    "match_method" VARCHAR(50) NOT NULL,
    "similarity" DECIMAL(5, 2),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" VARCHAR(255),
    "verified_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "league_mappings_svenska_spel_league_id_fkey" FOREIGN KEY ("svenska_spel_league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "league_mappings_api_football_league_id_idx" ON "league_mappings"("api_football_league_id");
CREATE INDEX IF NOT EXISTS "league_mappings_confidence_idx" ON "league_mappings"("confidence");
CREATE INDEX IF NOT EXISTS "league_mappings_verified_idx" ON "league_mappings"("verified");

-- Teams that couldn't be automatically matched - for admin review
CREATE TABLE IF NOT EXISTS "unmapped_teams" (
    "id" SERIAL PRIMARY KEY,
    "svenska_spel_team_id" INTEGER NOT NULL,
    "team_name" VARCHAR(255) NOT NULL,
    "league_name" VARCHAR(255),
    "country_name" VARCHAR(255),
    "betradar_id" VARCHAR(100),
    "kambi_id" VARCHAR(100),
    "best_candidates" JSONB,
    "attempted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(6),
    "resolved_by" VARCHAR(255),
    CONSTRAINT "unmapped_teams_svenska_spel_team_id_fkey" FOREIGN KEY ("svenska_spel_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "unmapped_teams_svenska_spel_team_id_idx" ON "unmapped_teams"("svenska_spel_team_id");
CREATE INDEX IF NOT EXISTS "unmapped_teams_resolved_idx" ON "unmapped_teams"("resolved");
CREATE INDEX IF NOT EXISTS "unmapped_teams_attempted_at_idx" ON "unmapped_teams"("attempted_at");

-- API-Football response cache
CREATE TABLE IF NOT EXISTS "api_football_cache" (
    "id" SERIAL PRIMARY KEY,
    "endpoint" VARCHAR(255) NOT NULL,
    "params" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_football_cache_endpoint_params_key" UNIQUE ("endpoint", "params")
);

CREATE INDEX IF NOT EXISTS "api_football_cache_expires_at_idx" ON "api_football_cache"("expires_at");
CREATE INDEX IF NOT EXISTS "api_football_cache_endpoint_idx" ON "api_football_cache"("endpoint");

-- API-Football usage tracking for quota monitoring
CREATE TABLE IF NOT EXISTS "api_football_usage" (
    "id" SERIAL PRIMARY KEY,
    "endpoint" VARCHAR(255) NOT NULL,
    "params" JSONB,
    "status_code" INTEGER NOT NULL,
    "response_time_ms" INTEGER,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "api_football_usage_endpoint_idx" ON "api_football_usage"("endpoint");
CREATE INDEX IF NOT EXISTS "api_football_usage_created_at_idx" ON "api_football_usage"("created_at");
CREATE INDEX IF NOT EXISTS "api_football_usage_status_code_idx" ON "api_football_usage"("status_code");
CREATE INDEX IF NOT EXISTS "api_football_usage_cached_idx" ON "api_football_usage"("cached");

-- Historical matches from API-Football for similarity search
CREATE TABLE IF NOT EXISTS "historical_matches" (
    "id" SERIAL PRIMARY KEY,
    "api_football_fixture_id" INTEGER NOT NULL UNIQUE,
    "api_football_league_id" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "home_team_id" INTEGER,
    "away_team_id" INTEGER,
    "home_team_name" VARCHAR(255) NOT NULL,
    "away_team_name" VARCHAR(255) NOT NULL,
    "match_date" TIMESTAMP(6) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "score_home" INTEGER,
    "score_away" INTEGER,
    "outcome" VARCHAR(5),
    "venue_id" INTEGER,
    "venue_name" VARCHAR(255),
    "statistics" JSONB,
    "events" JSONB,
    "lineups" JSONB,
    "has_statistics" BOOLEAN NOT NULL DEFAULT false,
    "has_events" BOOLEAN NOT NULL DEFAULT false,
    "has_lineups" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "historical_matches_league_season_idx" ON "historical_matches"("api_football_league_id", "season");
CREATE INDEX IF NOT EXISTS "historical_matches_teams_idx" ON "historical_matches"("home_team_id", "away_team_id");
CREATE INDEX IF NOT EXISTS "historical_matches_match_date_idx" ON "historical_matches"("match_date");
CREATE INDEX IF NOT EXISTS "historical_matches_outcome_idx" ON "historical_matches"("outcome");

-- Add API-Football columns to matches table
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "api_football_fixture_id" INTEGER;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "api_football_league_id" INTEGER;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "api_football_home_team_id" INTEGER;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "api_football_away_team_id" INTEGER;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "mapping_confidence" VARCHAR(10);

CREATE INDEX IF NOT EXISTS "matches_api_football_fixture_id_idx" ON "matches"("api_football_fixture_id");
CREATE INDEX IF NOT EXISTS "matches_mapping_confidence_idx" ON "matches"("mapping_confidence");

-- Add source tracking to match_scraped_data table
ALTER TABLE "match_scraped_data" ADD COLUMN IF NOT EXISTS "source" VARCHAR(50) NOT NULL DEFAULT 'web-scraping';
ALTER TABLE "match_scraped_data" ADD COLUMN IF NOT EXISTS "is_stale" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "match_scraped_data_source_idx" ON "match_scraped_data"("source");
CREATE INDEX IF NOT EXISTS "match_scraped_data_is_stale_idx" ON "match_scraped_data"("is_stale");

-- Update unique constraint on match_scraped_data to include source
-- First drop the old constraint if it exists, then add the new one
ALTER TABLE "match_scraped_data" DROP CONSTRAINT IF EXISTS "match_scraped_data_match_id_data_type_key";
ALTER TABLE "match_scraped_data" ADD CONSTRAINT "match_scraped_data_match_id_data_type_source_key" UNIQUE ("match_id", "data_type", "source");
