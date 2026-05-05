-- CreateTable
CREATE TABLE "platform_stats_snapshot" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "guilds_active" INTEGER NOT NULL DEFAULT 0,
    "tracked_member_distinct" INTEGER NOT NULL DEFAULT 0,
    "users_flagged" INTEGER NOT NULL DEFAULT 0,
    "manual_checks_total" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_stats_snapshot_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_stats_snapshot" ("id", "guilds_active", "tracked_member_distinct", "users_flagged", "manual_checks_total", "updated_at")
VALUES ('default', 0, 0, 0, 0, CURRENT_TIMESTAMP);
