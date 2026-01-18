-- Add Statistical Calculations Tables
-- Team ratings for Elo-based strength tracking and match calculations for predictions

-- Team ratings table
CREATE TABLE "team_ratings" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "rating_type" VARCHAR(20) NOT NULL,
    "rating_value" DECIMAL(10, 4) NOT NULL,
    "model_version" VARCHAR(20) NOT NULL,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "confidence" VARCHAR(10) NOT NULL,
    "last_match_date" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_ratings_pkey" PRIMARY KEY ("id")
);

-- Match calculations table
CREATE TABLE "match_calculations" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "model_prob_home" DECIMAL(5, 4) NOT NULL,
    "model_prob_draw" DECIMAL(5, 4) NOT NULL,
    "model_prob_away" DECIMAL(5, 4) NOT NULL,
    "expected_home_goals" DECIMAL(5, 3) NOT NULL,
    "expected_away_goals" DECIMAL(5, 3) NOT NULL,
    "fair_prob_home" DECIMAL(5, 4) NOT NULL,
    "fair_prob_draw" DECIMAL(5, 4) NOT NULL,
    "fair_prob_away" DECIMAL(5, 4) NOT NULL,
    "bookmaker_margin" DECIMAL(5, 4) NOT NULL,
    "ev_home" DECIMAL(6, 4) NOT NULL,
    "ev_draw" DECIMAL(6, 4) NOT NULL,
    "ev_away" DECIMAL(6, 4) NOT NULL,
    "best_value_outcome" VARCHAR(5),
    "home_form_ema" DECIMAL(5, 4),
    "away_form_ema" DECIMAL(5, 4),
    "home_xg_trend" DECIMAL(5, 3),
    "away_xg_trend" DECIMAL(5, 3),
    "home_regression_flag" VARCHAR(20),
    "away_regression_flag" VARCHAR(20),
    "home_rest_days" INTEGER,
    "away_rest_days" INTEGER,
    "importance_score" DECIMAL(5, 4),
    "data_quality" VARCHAR(10) NOT NULL,
    "model_version" VARCHAR(20) NOT NULL,
    "calculated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_calculations_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "team_ratings_team_id_rating_type_model_version_key" ON "team_ratings"("team_id", "rating_type", "model_version");
CREATE UNIQUE INDEX "match_calculations_match_id_key" ON "match_calculations"("match_id");

-- Indexes for team_ratings
CREATE INDEX "team_ratings_team_id_idx" ON "team_ratings"("team_id");
CREATE INDEX "team_ratings_rating_type_idx" ON "team_ratings"("rating_type");
CREATE INDEX "team_ratings_model_version_idx" ON "team_ratings"("model_version");
CREATE INDEX "team_ratings_confidence_idx" ON "team_ratings"("confidence");

-- Indexes for match_calculations
CREATE INDEX "match_calculations_match_id_idx" ON "match_calculations"("match_id");
CREATE INDEX "match_calculations_data_quality_idx" ON "match_calculations"("data_quality");
CREATE INDEX "match_calculations_calculated_at_idx" ON "match_calculations"("calculated_at");
CREATE INDEX "match_calculations_best_value_outcome_idx" ON "match_calculations"("best_value_outcome");

-- Foreign key constraint
ALTER TABLE "match_calculations" ADD CONSTRAINT "match_calculations_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
