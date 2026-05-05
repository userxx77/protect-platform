ALTER TYPE "OutboxStatus" ADD VALUE 'PROCESSING';

ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "processing_started_at" TIMESTAMP(3);

UPDATE "outbox_events" SET "updated_at" = COALESCE("updated_at", "created_at");

CREATE INDEX "outbox_events_status_processing_started_at_idx" ON "outbox_events"("status", "processing_started_at");

CREATE TABLE "processed_events" (
    "event_id" UUID NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

CREATE INDEX "processed_events_recorded_at_idx" ON "processed_events"("recorded_at" DESC);
