#!/usr/bin/env bash
# Clear Prisma P3009 "failed migration" state so `migrate deploy` can run again.
# Use after a migration crashed mid-way (e.g. old enum migration). Run ON THE VPS from repo root.
#
# Usage:
#   bash scripts/migrate-resolve-failed.sh
#   bash scripts/migrate-resolve-failed.sh 20260606120000_watch_tier_guild_blacklist
#
# Then redeploy: DEPLOY_BRANCH=main bash scripts/vps-update.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NAME="${1:-20260606120000_watch_tier_guild_blacklist}"

echo "==> Mark failed migration as rolled back: $NAME"
echo "    (DB was likely unchanged; Prisma still blocks deploy until this is cleared.)"

docker compose run --rm \
  --entrypoint "" \
  migrate \
  /bin/sh -c "cd /repo/apps/api && npx prisma migrate resolve --rolled-back \"$NAME\""

echo "==> Done. Run: DEPLOY_BRANCH=main bash scripts/vps-update.sh"
