-- Enable Row Level Security (RLS) on all application tables
-- Note: _prisma_migrations is excluded as it's managed internally by Prisma
-- and accessed via direct database connection (not through Supabase client)

-- =====================================================
-- Enable RLS on Reference Tables
-- =====================================================
ALTER TABLE "countries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leagues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Enable RLS on Core Data Tables
-- =====================================================
ALTER TABLE "draws" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "match_odds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "match_scraped_data" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "match_embeddings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "predictions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prediction_performance" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Enable RLS on Operational Tables
-- =====================================================
ALTER TABLE "scrape_operations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "backfill_operations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_performance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generated_coupons" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Create SELECT Policies for authenticated users
-- These allow authenticated users to read all data
-- (Required for Supabase Realtime subscriptions to work)
-- =====================================================

-- Reference tables
CREATE POLICY "authenticated_select_countries" ON "countries"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_leagues" ON "leagues"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_teams" ON "teams"
  FOR SELECT TO authenticated USING (true);

-- Core data tables
CREATE POLICY "authenticated_select_draws" ON "draws"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_matches" ON "matches"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_match_odds" ON "match_odds"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_match_scraped_data" ON "match_scraped_data"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_match_embeddings" ON "match_embeddings"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_predictions" ON "predictions"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_prediction_performance" ON "prediction_performance"
  FOR SELECT TO authenticated USING (true);

-- Operational tables
CREATE POLICY "authenticated_select_scrape_operations" ON "scrape_operations"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_ai_usage" ON "ai_usage"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_backfill_operations" ON "backfill_operations"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_system_performance" ON "system_performance"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_generated_coupons" ON "generated_coupons"
  FOR SELECT TO authenticated USING (true);

-- =====================================================
-- Note: service_role bypasses RLS automatically
-- No explicit policy needed for service_role access
--
-- Prisma operations are unaffected because they use
-- direct PostgreSQL connection (DATABASE_URL) which
-- bypasses RLS entirely.
-- =====================================================
