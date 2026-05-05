#!/bin/sh
set -e
if [ -n "${REDIS_PASSWORD:-}" ]; then
  exec redis-server --requirepass "$REDIS_PASSWORD"
else
  exec redis-server
fi
