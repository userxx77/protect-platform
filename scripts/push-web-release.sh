#!/usr/bin/env bash
# Run from repo root after fixing the web app. Verifies build; optionally commit + push.
# Usage:
#   bash scripts/push-web-release.sh              # build only + print push hint
#   COMMIT_AND_PUSH=1 bash scripts/push-web-release.sh   # build, commit all, push main
#   COMMIT_AND_PUSH=1 BRANCH=my-branch COMMIT_MSG="msg" bash scripts/push-web-release.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

pnpm --filter @protect/web run build

BRANCH="${BRANCH:-main}"
MSG="${COMMIT_MSG:-fix(web): OAuth middleware + instant Discord sign-in}"

if [[ "${COMMIT_AND_PUSH:-}" == "1" ]]; then
  git add -A
  git commit -m "$MSG"
  git push origin "$BRANCH"
  echo "Pushed to origin/$BRANCH"
else
  echo "OK: web build passed."
  echo "Push: COMMIT_AND_PUSH=1 bash scripts/push-web-release.sh"
  echo "Or:    git add -A && git commit -m \"$MSG\" && git push origin $BRANCH"
fi
