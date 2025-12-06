-- Add draw lifecycle tracking fields
-- These fields help determine which URL pattern to use for scraping
-- is_current: true for active/upcoming draws, false for archived/historic draws
-- archived_at: timestamp when draw was moved to historic status

-- Add is_current column with default true for existing draws
ALTER TABLE "draws" ADD COLUMN "is_current" BOOLEAN NOT NULL DEFAULT true;

-- Add archived_at column (nullable)
ALTER TABLE "draws" ADD COLUMN "archived_at" TIMESTAMP(6);

-- Create index on is_current for efficient filtering
CREATE INDEX "draws_is_current_idx" ON "draws"("is_current");

-- Set existing completed draws to archived status
UPDATE "draws" 
SET "is_current" = false, "archived_at" = NOW() 
WHERE "status" = 'Completed';

