-- CreateEnum
CREATE TYPE "FlagLevel" AS ENUM ('CLEAN', 'SUSPICIOUS', 'HIGH_RISK', 'CONFIRMED_CHEATER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'SPAM');

-- CreateEnum
CREATE TYPE "FlagSource" AS ENUM ('TRUSTED_COMMAND', 'API', 'REPORT_ESCALATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('FLAG_CREATED', 'REPORT_CREATED', 'SERVER_CONFIG_UPDATED', 'TRUST_GRANTED', 'USER_TOUCHED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "discord_id" TEXT NOT NULL,
    "flag_score" INTEGER NOT NULL DEFAULT 0,
    "flag_level" "FlagLevel" NOT NULL DEFAULT 'CLEAN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "weight" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source" "FlagSource" NOT NULL DEFAULT 'TRUSTED_COMMAND',
    "actor_discord_id" TEXT NOT NULL,
    "guild_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_discord_id" TEXT NOT NULL,
    "reported_user_id" UUID NOT NULL,
    "guild_id" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolver_note" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "discord_user_id" TEXT NOT NULL,
    "trust_level" INTEGER NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by_discord_id" TEXT,

    CONSTRAINT "trusted_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_discord_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_discord_id_key" ON "users"("discord_id");

-- CreateIndex
CREATE INDEX "flags_user_id_created_at_idx" ON "flags"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "servers_guild_id_key" ON "servers"("guild_id");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_users_discord_user_id_key" ON "trusted_users"("discord_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp" DESC);

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
