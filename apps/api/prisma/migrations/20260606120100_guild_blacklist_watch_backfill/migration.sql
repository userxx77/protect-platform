-- CreateTable
CREATE TABLE "guild_blacklist" (
    "guild_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_by_discord_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guild_blacklist_pkey" PRIMARY KEY ("guild_id")
);

-- Backfill: split former low-score SUSPICIOUS into WATCH (aligns with FLAG_THRESHOLD_WATCH=1, SUSPICIOUS=3)
UPDATE "users" SET "flag_level" = 'WATCH' WHERE "flag_level" = 'SUSPICIOUS' AND "flag_score" >= 1 AND "flag_score" < 3;
