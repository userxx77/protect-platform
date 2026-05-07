-- CreateEnum
CREATE TYPE "LicenseKeyStatus" AS ENUM ('UNUSED', 'REDEEMED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SupportTicketMessageAuthor" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- AlterEnum AuditAction
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'LICENSE_KEY_GENERATED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'LICENSE_KEY_REDEEMED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'LICENSE_KEY_REVOKED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable license_keys
CREATE TABLE IF NOT EXISTS "license_keys" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "status" "LicenseKeyStatus" NOT NULL DEFAULT 'UNUSED',
    "plan_code" TEXT,
    "preset_valid_days" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_discord_id" TEXT,
    "redeemed_at" TIMESTAMP(3),
    "redeemed_guild_id" TEXT,
    "redeemed_by_discord_id" TEXT,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "license_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "license_keys_code_key" ON "license_keys"("code");
CREATE INDEX IF NOT EXISTS "license_keys_status_idx" ON "license_keys"("status");

-- CreateTable support_ticket_messages
CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_kind" "SupportTicketMessageAuthor" NOT NULL,
    "author_discord_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "support_ticket_messages_ticket_id_created_at_idx" ON "support_ticket_messages"("ticket_id", "created_at");

DO $$ BEGIN
 ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
