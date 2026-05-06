-- PlatformRole: checker tier (Postgres 15+: IF NOT EXISTS avoids duplicate-label errors)
-- Default CHECKER is applied in the following migration so this file commits before using the new label.
ALTER TYPE "PlatformRole" ADD VALUE IF NOT EXISTS 'CHECKER';

-- Audit: flag admin CRUD
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FLAG_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FLAG_UPDATED';

-- Support tickets (evidence workflow) — safe if a previous attempt partially created objects
DO $$
BEGIN
  CREATE TYPE "SupportTicketStatus" AS ENUM (
    'OPEN',
    'NEEDS_EVIDENCE',
    'EVIDENCE_SUBMITTED',
    'UNDER_REVIEW',
    'RESOLVED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "guild_id" TEXT,
    "reporter_discord_id" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "admin_note" TEXT,
    "user_message" TEXT,
    "evidence_links" JSONB NOT NULL DEFAULT '[]',
    "assigned_admin_discord_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_report_id_key" ON "support_tickets"("report_id");
CREATE INDEX IF NOT EXISTS "support_tickets_reporter_discord_id_status_idx" ON "support_tickets"("reporter_discord_id", "status");
CREATE INDEX IF NOT EXISTS "support_tickets_guild_id_status_idx" ON "support_tickets"("guild_id", "status");

DO $$
BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "support_ticket_attachments" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "support_ticket_attachments_ticket_id_idx" ON "support_ticket_attachments"("ticket_id");

DO $$
BEGIN
  ALTER TABLE "support_ticket_attachments" ADD CONSTRAINT "support_ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
