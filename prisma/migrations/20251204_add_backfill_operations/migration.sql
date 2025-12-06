-- CreateTable
CREATE TABLE "backfill_operations" (
    "id" SERIAL NOT NULL,
    "operation_type" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "total_draws" INTEGER NOT NULL,
    "processed_draws" INTEGER NOT NULL DEFAULT 0,
    "successful_draws" INTEGER NOT NULL DEFAULT 0,
    "failed_draws" INTEGER NOT NULL DEFAULT 0,
    "skipped_draws" INTEGER NOT NULL DEFAULT 0,
    "error_log" JSONB,
    "config" JSONB,
    "started_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),
    "cancelled_at" TIMESTAMP(6),

    CONSTRAINT "backfill_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backfill_operations_status_idx" ON "backfill_operations"("status");

-- CreateIndex
CREATE INDEX "backfill_operations_started_at_idx" ON "backfill_operations"("started_at");

-- CreateIndex
CREATE INDEX "backfill_operations_operation_type_idx" ON "backfill_operations"("operation_type");
