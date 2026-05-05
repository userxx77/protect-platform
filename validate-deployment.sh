#!/usr/bin/env bash
# Post-deploy validation (VPS / Docker Compose). Exit 0 = all checks passed.
# Usage: chmod +x validate-deployment.sh && ./validate-deployment.sh
# Requires: docker compose, curl; optional .env in repo root for ports/passwords.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

FAILURES=0
note_fail() {
  echo "FAIL: $*" >&2
  FAILURES=$((FAILURES + 1))
}

note_ok() {
  echo "OK: $*"
}

if [[ -f .env ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

API_PORT="${API_PUBLISH_PORT:-3001}"
WEB_PORT="${WEB_PUBLISH_PORT:-3000}"
API_BASE="http://127.0.0.1:${API_PORT}"
WEB_BASE="http://127.0.0.1:${WEB_PORT}"

echo "=== Protect deployment validation ==="

if ! docker compose version >/dev/null 2>&1; then
  note_fail "docker compose not available"
  exit 1
fi

EXPECTED=(postgres redis api worker bot web)
mapfile -t RUNNING_SVCS < <(docker compose ps --status running --services 2>/dev/null || true)
for s in "${EXPECTED[@]}"; do
  found=0
  for r in "${RUNNING_SVCS[@]}"; do
    if [[ "$r" == "$s" ]]; then
      found=1
      break
    fi
  done
  if [[ "$found" -eq 1 ]]; then
    note_ok "compose service running: $s"
  else
    note_fail "compose service not running: $s"
  fi
done

# --- API ---
if curl -sf "${API_BASE}/health" >/dev/null; then
  note_ok "API GET /health"
else
  note_fail "API GET /health (curl ${API_BASE}/health)"
fi

if curl -sf "${API_BASE}/ready" >/dev/null; then
  note_ok "API GET /ready"
else
  note_fail "API GET /ready (curl ${API_BASE}/ready)"
fi

# --- Web ---
if curl -sf "${WEB_BASE}/api/health" >/dev/null; then
  note_ok "Web GET /api/health"
else
  note_fail "Web GET /api/health"
fi

# --- Postgres ---
if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-protect}" -d "${POSTGRES_DB:-protect}" >/dev/null 2>&1; then
  note_ok "Postgres pg_isready"
else
  note_fail "Postgres pg_isready"
fi

# --- Redis ---
if [[ -n "${REDIS_PASSWORD:-}" ]]; then
  if docker compose exec -T redis redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q PONG; then
    note_ok "Redis PING (authenticated)"
  else
    note_fail "Redis PING"
  fi
else
  if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
    note_ok "Redis PING"
  else
    note_fail "Redis PING"
  fi
fi

# --- Worker heartbeat (optional keys until first loop) ---
REDIS_CLI=(docker compose exec -T redis redis-cli)
if [[ -n "${REDIS_PASSWORD:-}" ]]; then
  REDIS_CLI+=( -a "$REDIS_PASSWORD" )
fi
LAST_ACTIVE=$("${REDIS_CLI[@]}" GET protect:worker:last_active_at 2>/dev/null | tr -d '\r\n' || echo "")
if [[ -n "$LAST_ACTIVE" && "$LAST_ACTIVE" != "(nil)" ]]; then
  NOW_MS=$(($(date +%s) * 1000))
  AGE=$((NOW_MS - LAST_ACTIVE))
  if [[ "$AGE" -lt 180000 ]]; then
    note_ok "Worker last_active age ${AGE}ms (<3m)"
  else
    note_fail "Worker last_active stale (${AGE}ms); check worker logs"
  fi
else
  note_fail "Worker heartbeat key missing or empty (worker may still be starting — re-run in 60s)"
fi

# --- Bot (log-based; Discord has no unauthenticated status endpoint here) ---
if docker compose logs bot --tail 500 2>/dev/null | grep -q "discord_client_ready"; then
  note_ok "Bot log shows discord_client_ready"
else
  note_fail "Bot log missing discord_client_ready (tail bot logs)"
fi

echo "=== Summary: ${FAILURES} failure(s) ==="
if [[ "$FAILURES" -gt 0 ]]; then
  echo "Tip: admin JWT → GET ${API_BASE}/internal/ops/debug for unified state" >&2
  exit 1
fi
exit 0
