#!/bin/sh
set -e
cd /repo/apps/api

skip_raw="${SKIP_PRISMA_MIGRATE:-}"
if [ "$skip_raw" = "1" ] || [ "$skip_raw" = "true" ] || [ "$skip_raw" = "yes" ]; then
  echo "{\"msg\":\"api_entrypoint_migrate_skipped\",\"timestamp\":\"$(date -Iseconds)\"}"
  exec node dist/main.js
fi

max_attempts="${PRISMA_MIGRATE_MAX_ATTEMPTS:-60}"
attempt=1
sleep_sec="${PRISMA_MIGRATE_RETRY_SEC:-2}"

echo "{\"msg\":\"api_entrypoint_migrate_start\",\"timestamp\":\"$(date -Iseconds)\"}"

while [ "$attempt" -le "$max_attempts" ]; do
  if npx prisma migrate deploy; then
    echo "{\"msg\":\"api_entrypoint_migrate_ok\",\"timestamp\":\"$(date -Iseconds)\"}"
    exec node dist/main.js
  fi
  echo "{\"msg\":\"api_entrypoint_migrate_retry\",\"attempt\":$attempt,\"max\":$max_attempts,\"timestamp\":\"$(date -Iseconds)\"}" >&2
  attempt=$((attempt + 1))
  sleep "$sleep_sec"
done

echo "{\"msg\":\"api_entrypoint_migrate_failed\",\"maxAttempts\":$max_attempts,\"timestamp\":\"$(date -Iseconds)\"}" >&2
exit 1
