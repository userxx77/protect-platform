#!/usr/bin/env bash
# Run ON THE VPS in the repo clone (Protect root, same dir as docker-compose.yml).
# Always works: DEPLOY_BRANCH=main bash scripts/vps-update.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BRANCH="${DEPLOY_BRANCH:-main}"

echo "==> git pull ($BRANCH)"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> docker compose up --build -d"
docker compose up -d --build

echo "==> migrate log (last lines)"
docker compose logs migrate --tail 40 || true

echo "==> optional: validate (from repo root)"
if [[ -x ./validate-deployment.sh ]]; then
  ./validate-deployment.sh || true
fi

echo "Done. Check https://YOUR_DASHBOARD/api/ready and Discord slash commands after deploy."
