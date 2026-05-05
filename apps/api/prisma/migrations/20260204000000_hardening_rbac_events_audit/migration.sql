-- CreateEnum
CREATE TYPE "ActorKind" AS ENUM ('USER', 'BOT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('ADMIN', 'USER');

-- AlterEnum AuditAction (ignore if exists)
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'REPORT_REJECTED_ABUSE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'ROLE_ASSIGNED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'API_CLIENT_CREATED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "FlagSource" ADD VALUE 'COMMUNITY_REPORT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "FlagSource" ADD VALUE 'ADMIN_OVERRIDE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable audit_logs
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "target_id" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_kind" "ActorKind" NOT NULL DEFAULT 'USER';

-- AlterTable flags
ALTER TABLE "flags" ADD COLUMN IF NOT EXISTS "effective_weight" INTEGER;

-- AlterTable reports
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "dedupe_key" TEXT;

CREATE INDEX IF NOT EXISTS "reports_reporter_reported_guild_created_idx" ON "reports"("reporter_discord_id", "reported_user_id", "guild_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "audit_logs_action_timestamp_idx" ON "audit_logs"("action", "timestamp" DESC);

CREATE INDEX IF NOT EXISTS "audit_logs_target_id_timestamp_idx" ON "audit_logs"("target_id", "timestamp" DESC);

CREATE TABLE IF NOT EXISTS "platform_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "discord_user_id" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_accounts_discord_user_id_key" ON "platform_accounts"("discord_user_id");

CREATE TABLE IF NOT EXISTS "api_clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "label" TEXT NOT NULL,
    "hashed_secret" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "tenant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_clients_pkey" PRIMARY KEY ("id")
);
