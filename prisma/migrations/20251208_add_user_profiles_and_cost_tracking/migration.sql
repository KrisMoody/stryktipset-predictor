-- Add user_id to ai_usage for per-user cost tracking
-- AlterTable
ALTER TABLE "ai_usage" ADD COLUMN "user_id" UUID;

-- CreateTable for user profiles with cost cap settings
CREATE TABLE "user_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "cost_cap_usd" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "cap_bypass_until" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_profiles_email_idx" ON "user_profiles"("email");

-- CreateIndex for user cost queries
CREATE INDEX "ai_usage_user_id_idx" ON "ai_usage"("user_id");

-- CreateIndex for weekly spending queries
CREATE INDEX "ai_usage_user_id_timestamp_idx" ON "ai_usage"("user_id", "timestamp");
