-- Monotonic aggregate version for cache/events; cheap DB safety for scores.
ALTER TABLE "users"
  ADD COLUMN "state_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "users"
  ADD CONSTRAINT "users_flag_score_nonnegative" CHECK ("flag_score" >= 0);
