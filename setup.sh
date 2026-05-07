#!/usr/bin/env bash
# Protect platform — one-shot VPS bootstrap (Ubuntu / bash).
# Usage: chmod +x setup.sh && ./setup.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

rand_b64() { openssl rand -base64 32 | tr -d '\n'; }
rand_hex() { openssl rand -hex 24; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

require_cmd docker
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 plugin required (docker compose)." >&2
  exit 1
fi
require_cmd openssl

ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE="$ROOT_DIR/.env.example"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    echo "Missing .env.example" >&2
    exit 1
  fi
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "Created .env from .env.example"
fi

prompt() {
  local var="$1" default="${2:-}"
  local value=""
  if [[ -n "$default" ]]; then
    read -r -p "$var [$default]: " value || true
    value="${value:-$default}"
  else
    read -r -p "$var: " value || true
  fi
  printf '%s' "$value"
}

echo "=== Protect VPS setup ==="
echo "Enter values (leave blank to auto-generate secrets)."

POSTGRES_USER="$(prompt POSTGRES_USER protect)"
POSTGRES_DB="$(prompt POSTGRES_DB protect)"
POSTGRES_PASSWORD="$(prompt DATABASE_PASSWORD "")"
[[ -z "$POSTGRES_PASSWORD" ]] && POSTGRES_PASSWORD="$(rand_hex)"

DISCORD_BOT_TOKEN="$(prompt BOT_TOKEN "")"
[[ -z "$DISCORD_BOT_TOKEN" ]] && { echo "BOT_TOKEN is required for Discord." >&2; exit 1; }

DISCORD_APPLICATION_ID="$(prompt DISCORD_APPLICATION_ID "")"
[[ -z "$DISCORD_APPLICATION_ID" ]] && { echo "DISCORD_APPLICATION_ID is required for slash commands." >&2; exit 1; }

DISCORD_CLIENT_ID="$(prompt DISCORD_CLIENT_ID "")"
DISCORD_CLIENT_SECRET="$(prompt DISCORD_CLIENT_SECRET "")"
[[ -z "$DISCORD_CLIENT_ID" || -z "$DISCORD_CLIENT_SECRET" ]] && {
  echo "DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET are required for the web dashboard (NextAuth)." >&2
  exit 1
}

echo "DISCORD_GUILD_ID optional — leave empty for global slash commands (all servers). If set, commands register in that guild only (instant; use for single-guild dev)."
DISCORD_GUILD_ID="$(prompt DISCORD_GUILD_ID "")"

JWT_SECRET="$(prompt JWT_SECRET "")"
[[ -z "$JWT_SECRET" ]] && JWT_SECRET="$(rand_b64)"

BOT_API_KEY="$(prompt API_KEY "")"
[[ -z "$BOT_API_KEY" ]] && BOT_API_KEY="$(rand_hex)"

REDIS_PASSWORD="$(prompt REDIS_PASSWORD optional '')"

echo ""
echo "Public URLs (no trailing slash)."
echo "  - Dashboard = waar Next.js + Discord OAuth draaien (NEXTAUTH_URL)."
echo "  - API       = publieke API (browser / NEXT_PUBLIC_API_URL)."
echo "  - Main site = optioneel (bv. marketing homepage); staat in .env als MAIN_SITE_URL."

DASHBOARD_URL="$(prompt DASHBOARD_URL "https://dashboard.sentra.gg")"
API_PUBLIC_URL="$(prompt API_PUBLIC_URL "https://api.sentra.gg")"
MAIN_SITE_URL="$(prompt MAIN_SITE_URL optional 'https://sentra.gg')"

if [[ "$DASHBOARD_URL" == */ ]]; then DASHBOARD_URL="${DASHBOARD_URL%/}"; fi
if [[ "$API_PUBLIC_URL" == */ ]]; then API_PUBLIC_URL="${API_PUBLIC_URL%/}"; fi
if [[ -n "$MAIN_SITE_URL" && "$MAIN_SITE_URL" == */ ]]; then MAIN_SITE_URL="${MAIN_SITE_URL%/}"; fi

# Docker internal Redis URL
if [[ -n "$REDIS_PASSWORD" ]]; then
  REDIS_URL="redis://:${REDIS_PASSWORD}@redis:6379"
else
  REDIS_URL="redis://redis:6379"
fi

DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"

remove_kv() {
  local key="$1" file="$2"
  [[ ! -f "$file" ]] && return 0
  local tmp
  tmp="$(mktemp)"
  grep -v "^${key}=" "$file" >"$tmp" || true
  mv "$tmp" "$file"
}

upsert_kv() {
  local key="$1" val="$2" file="$3"
  local tmp
  tmp="$(mktemp)"
  if [[ -f "$file" ]]; then
    grep -v "^${key}=" "$file" >"$tmp" || true
  else
    : >"$tmp"
  fi
  printf '%s=%s\n' "$key" "$val" >>"$tmp"
  mv "$tmp" "$file"
}

upsert_kv NODE_ENV production "$ENV_FILE"
upsert_kv POSTGRES_USER "$POSTGRES_USER" "$ENV_FILE"
upsert_kv POSTGRES_PASSWORD "$POSTGRES_PASSWORD" "$ENV_FILE"
upsert_kv POSTGRES_DB "$POSTGRES_DB" "$ENV_FILE"
upsert_kv DATABASE_URL "$DATABASE_URL" "$ENV_FILE"
upsert_kv REDIS_URL "$REDIS_URL" "$ENV_FILE"
if [[ -n "$REDIS_PASSWORD" ]]; then
  upsert_kv REDIS_PASSWORD "$REDIS_PASSWORD" "$ENV_FILE"
else
  remove_kv REDIS_PASSWORD "$ENV_FILE"
fi

upsert_kv DISCORD_BOT_TOKEN "$DISCORD_BOT_TOKEN" "$ENV_FILE"
upsert_kv DISCORD_APPLICATION_ID "$DISCORD_APPLICATION_ID" "$ENV_FILE"
upsert_kv DISCORD_CLIENT_ID "$DISCORD_CLIENT_ID" "$ENV_FILE"
upsert_kv DISCORD_CLIENT_SECRET "$DISCORD_CLIENT_SECRET" "$ENV_FILE"
if [[ -n "$DISCORD_GUILD_ID" ]]; then
  upsert_kv DISCORD_GUILD_ID "$DISCORD_GUILD_ID" "$ENV_FILE"
else
  remove_kv DISCORD_GUILD_ID "$ENV_FILE"
fi

upsert_kv JWT_SECRET "$JWT_SECRET" "$ENV_FILE"
upsert_kv AUTH_SECRET "$JWT_SECRET" "$ENV_FILE"
upsert_kv DASHBOARD_JWT_SECRET "$JWT_SECRET" "$ENV_FILE"
upsert_kv BOT_API_KEY "$BOT_API_KEY" "$ENV_FILE"

upsert_kv API_BASE_URL "http://api:3001" "$ENV_FILE"
upsert_kv WEB_URL "$DASHBOARD_URL" "$ENV_FILE"
upsert_kv NEXTAUTH_URL "$DASHBOARD_URL" "$ENV_FILE"
upsert_kv AUTH_URL "$DASHBOARD_URL" "$ENV_FILE"
upsert_kv API_PUBLIC_URL "$API_PUBLIC_URL" "$ENV_FILE"
upsert_kv NEXT_PUBLIC_API_URL "$API_PUBLIC_URL" "$ENV_FILE"
if [[ "$DASHBOARD_URL" == *sentra.gg* ]]; then
  upsert_kv NEXT_PUBLIC_APEX_HOSTS "sentra.gg,www.sentra.gg" "$ENV_FILE"
  upsert_kv NEXT_PUBLIC_APP_ORIGIN "$DASHBOARD_URL" "$ENV_FILE"
else
  remove_kv NEXT_PUBLIC_APEX_HOSTS "$ENV_FILE"
  remove_kv NEXT_PUBLIC_APP_ORIGIN "$ENV_FILE"
fi
if [[ -n "$MAIN_SITE_URL" ]]; then
  upsert_kv MAIN_SITE_URL "$MAIN_SITE_URL" "$ENV_FILE"
else
  remove_kv MAIN_SITE_URL "$ENV_FILE"
fi

upsert_kv API_PORT "3001" "$ENV_FILE"

echo ""
echo "Building and starting stack..."
docker compose up -d --build

echo ""
echo "=== Done ==="
echo "Main site (reference): ${MAIN_SITE_URL:-"(not set — optional)"}"
echo "Dashboard (Next.js):  $DASHBOARD_URL"
echo "API (public):         $API_PUBLIC_URL  (OpenAPI: $API_PUBLIC_URL/docs)"
echo "Discord OAuth redirect must include: ${DASHBOARD_URL}/api/auth/callback/discord"
echo "Bot: ensure gateway intents (Guilds, Guild Members) are on for your app; slash commands register on bot start."
echo ".env written at:  $ENV_FILE"
echo "Validate:          chmod +x validate-deployment.sh && ./validate-deployment.sh"
