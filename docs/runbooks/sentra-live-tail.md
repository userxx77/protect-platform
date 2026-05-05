# Live event monitor (`sentra monitor` / `sentra-tail`)

Colored CLI that subscribes to the same Redis Pub/Sub channels the API worker publishes to (domain events). Use on a VPS or locally with access to **`REDIS_URL`**.

## Setup

From repo root after install and build:

```bash
pnpm install
pnpm --filter @protect/ops-cli run build
```

## Environment

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | **Required.** Same Redis as API/worker/bot. |
| `DISCORD_BOT_TOKEN` | Optional. Enables `--enrich` name resolution via Discord REST. |
| `API_PUBLIC_URL` or `API_BASE_URL` | Base URL for periodic stats (default `http://127.0.0.1:3001`). Used to call `GET /v1/public/platform-stats`. |
| `SENTRA_OPS_STATS_KEY` | **Required** for the stats footer when `--stats-interval` > 0. Must match the API env value; the CLI sends `Authorization: Bearer …`. |

## Run

```bash
# load .env from project root if you use one
export REDIS_URL=redis://127.0.0.1:6379
export DISCORD_BOT_TOKEN=   # optional
pnpm --filter @protect/ops-cli exec node apps/ops-cli/dist/index.js monitor --enrich --stats-interval=45
```

Flags:

- **`--enrich`** — resolve Discord usernames and guild names (needs `DISCORD_BOT_TOKEN`). Without it, IDs are shown.
- **`--stats-interval=N`** — seconds between summary lines from the operator-only stats API (default `30`, max `600`). Requires **`SENTRA_OPS_STATS_KEY`** in the environment (same secret as the API).

## Docker Compose (one-off)

From the host with Compose network access (replace network and Redis URL as appropriate):

```bash
docker compose run --rm -e REDIS_URL=redis://redis:6379 -e API_BASE_URL=http://api:3001 -e SENTRA_OPS_STATS_KEY="$SENTRA_OPS_STATS_KEY" ops-cli
```

Add a `ops-cli` service in `docker-compose.yml` only if you want this pattern regularly; otherwise run the binary on the host with `REDIS_URL` pointing at the published port.

## Related

- [production-deploy.md](./production-deploy.md) — stack topology.
- [sentra-licensing-policy.md](./sentra-licensing-policy.md) — admin flows.
