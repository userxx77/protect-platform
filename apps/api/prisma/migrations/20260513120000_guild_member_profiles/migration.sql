-- AlterTable
ALTER TABLE "servers" ADD COLUMN "owner_discord_id" TEXT,
ADD COLUMN "vanity_url_code" TEXT,
ADD COLUMN "premium_tier" INTEGER;

-- AlterTable
ALTER TABLE "guild_member_cache" ADD COLUMN "username" TEXT,
ADD COLUMN "global_name" TEXT,
ADD COLUMN "avatar_hash" TEXT;
