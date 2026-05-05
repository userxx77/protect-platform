#!/usr/bin/env bash
# Run sentra-tail on the Docker host using the same .env as Compose.
# Resolves redis://redis → 127.0.0.1 and http://api:3001 → http://127.0.0.1:<API_PUBLISH_PORT>
# so you do not need manual export lines.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f apps/ops-cli/dist/index.js ]]; then
  echo "Build ops-cli first: pnpm --filter @protect/ops-cli run build" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
[[ -f .env ]] && . ./.env
set +a

# Redis: .env often uses hostname "redis" for containers; on the host use published port.
if [[ -z "${SENTRA_TAIL_REDIS_URL:-}" ]]; then
  _ru="${REDIS_URL:-}"
  _ru="${_ru//@redis:/@127.0.0.1:}"
  _ru="${_ru//redis:\/\/redis:/redis:\/\/127.0.0.1:}"
  export REDIS_URL="${_ru}"
else
  export REDIS_URL="${SENTRA_TAIL_REDIS_URL}"
fi

# Stats API: prefer host loopback if .env only has Docker-internal http://api:3001
_ap="${API_BASE_URL:-}"
if [[ "${_ap}" == http://api:* ]]; then
  _port="${API_PUBLISH_PORT:-3001}"
  export API_BASE_URL="http://127.0.0.1:${_port}"
elif [[ -z "${_ap}" ]]; then
  export API_BASE_URL="${API_PUBLIC_URL:-http://127.0.0.1:${API_PUBLISH_PORT:-3001}}"
fi

if [[ -z "${SENTRA_OPS_STATS_KEY:-}" ]]; then
  echo "Warning: SENTRA_OPS_STATS_KEY not in .env — use --stats-interval=0 or add the key (same as API)." >&2
fi

exec node apps/ops-cli/dist/index.js "$@"
