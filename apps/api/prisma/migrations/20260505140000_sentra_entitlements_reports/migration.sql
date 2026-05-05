-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('INACTIVE', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "MemberSyncState" AS ENUM ('IDLE', 'QUEUED', 'RUNNING', 'PAUSED');

-- AlterEnum AuditAction
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'REPORT_APPROVED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'REPORT_REJECTED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'GUILD_DISCOVERED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'ENTITLEMENT_UPDATED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable servers
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "discord_name" TEXT;
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "icon_hash" TEXT;
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "approximate_member_count" INTEGER;
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "bot_joined_at" TIMESTAMP(3);
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "removed_at" TIMESTAMP(3);

-- AlterTable reports
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reviewed_by_discord_id" TEXT;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "flag_id" UUID;

-- CreateTable guild_entitlements
CREATE TABLE IF NOT EXISTS "guild_entitlements" (
    "guild_id" TEXT NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'INACTIVE',
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "plan_code" TEXT,
    "created_by_discord_id" TEXT,
    "last_member_sync_at" TIMESTAMP(3),
    "member_sync_state" "MemberSyncState" NOT NULL DEFAULT 'IDLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_entitlements_pkey" PRIMARY KEY ("guild_id")
);

-- CreateTable guild_member_cache
CREATE TABLE IF NOT EXISTS "guild_member_cache" (
    "id" UUID NOT NULL,
    "guild_id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'SYNC',

    CONSTRAINT "guild_member_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "guild_member_cache_guild_id_discord_user_id_key" ON "guild_member_cache"("guild_id", "discord_user_id");
CREATE INDEX IF NOT EXISTS "guild_member_cache_guild_id_idx" ON "guild_member_cache"("guild_id");

-- AddForeignKey
DO $$ BEGIN
 ALTER TABLE "guild_entitlements" ADD CONSTRAINT "guild_entitlements_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "servers"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
 ALTER TABLE "guild_member_cache" ADD CONSTRAINT "guild_member_cache_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "servers"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "reports_flag_id_key" ON "reports"("flag_id");

DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "flags"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Existing servers: grant ACTIVE entitlement (backward compatible)
INSERT INTO "guild_entitlements" ("guild_id", "status", "valid_from", "valid_until", "member_sync_state", "created_at", "updated_at")
SELECT s."guild_id", 'ACTIVE'::"LicenseStatus", TIMESTAMP '2020-01-01 00:00:00', NULL, 'IDLE'::"MemberSyncState", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "servers" s
WHERE NOT EXISTS (SELECT 1 FROM "guild_entitlements" e WHERE e."guild_id" = s."guild_id");
