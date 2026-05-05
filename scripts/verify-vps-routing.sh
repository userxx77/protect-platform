#!/usr/bin/env bash
# Run on the VPS from the repo root. Read-only checks for Caddy vs Docker routing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== Listeners (expect caddy:80,443; docker or bound ports:3000,3001) ==="
if command -v ss >/dev/null 2>&1; then
  sudo ss -tlnp 2>/dev/null | grep -E ':80 |:443|:3000|:3001' || echo "(no matches — check ss output manually)"
else
  echo "ss not found; install iproute2"
fi

echo ""
echo "=== Docker Compose (from $ROOT) ==="
if docker compose version >/dev/null 2>&1; then
  docker compose ps || echo "docker compose ps failed"
else
  echo "docker compose not available"
fi

WEB_PORT="${WEB_PUBLISH_PORT:-3000}"
API_PORT="${API_PUBLISH_PORT:-3001}"
DASHBOARD_HOST="${VERIFY_DASHBOARD_HOST:-dashboard.sentra.gg}"

echo ""
echo "=== Direct to Next (Host: $DASHBOARD_HOST) http://127.0.0.1:$WEB_PORT/api/health ==="
curl -sS -o /dev/null -w "HTTP %{http_code}\n" -H "Host: $DASHBOARD_HOST" "http://127.0.0.1:${WEB_PORT}/api/health" || echo "curl failed"

echo ""
echo "=== Direct to API http://127.0.0.1:$API_PORT/ready ==="
curl -sS -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:${API_PORT}/ready" || echo "curl failed"

echo ""
echo "=== Caddy recent logs (if service exists) ==="
if systemctl is-active --quiet caddy 2>/dev/null; then
  sudo journalctl -u caddy -n 25 --no-pager || true
else
  echo "caddy service not active or not installed"
fi

echo ""
echo "Done. Override HTTPS verification with:"
echo "  VERIFY_DASHBOARD_HOST=your.host curl -sI https://dashboard.sentra.gg/api/health"
