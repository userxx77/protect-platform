#!/usr/bin/env bash
# Run ON THE VPS in the repo clone (Protect root, same dir as docker-compose.yml).
# Always works: DEPLOY_BRANCH=main bash scripts/vps-update.sh
# (From ~ you must: cd protect-platform  # or wherever the clone lives)
#
# If migrate fails with Prisma P3009 (failed migration in DB), clear it then redeploy:
#   bash scripts/migrate-resolve-failed.sh
#   DEPLOY_BRANCH=main bash scripts/vps-update.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BRANCH="${DEPLOY_BRANCH:-main}"

# Match origin exactly: local edits on this clone (common on VPS) must not block deploy.
echo "==> git sync to origin/$BRANCH (discard local changes/commits on this clone)"
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> docker compose up --build -d"
docker compose up -d --build

echo "==> migrate log (last lines)"
docker compose logs migrate --tail 40 || true

echo "==> optional: validate (from repo root)"
if [[ -x ./validate-deployment.sh ]]; then
  ./validate-deployment.sh || true
fi

echo "Done. Check https://dashboard.sentra.gg/api/ready and Discord slash commands after deploy."
