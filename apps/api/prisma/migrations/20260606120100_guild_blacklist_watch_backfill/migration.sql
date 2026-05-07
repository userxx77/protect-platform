-- Idempotent table create (retry-safe if a previous run failed after enum but before this file finished)
CREATE TABLE IF NOT EXISTS "guild_blacklist" (
    "guild_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_by_discord_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guild_blacklist_pkey" PRIMARY KEY ("guild_id")
);

-- Backfill: same filter repeated is safe
UPDATE "users"
SET "flag_level" = 'WATCH'
WHERE "flag_level" = 'SUSPICIOUS'
  AND "flag_score" >= 1
  AND "flag_score" < 3;
