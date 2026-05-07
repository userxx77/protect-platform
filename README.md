# Protect — Anti-cheat intelligence platform

Monorepo layout:

| Package | Description |
|--------|--------------|
| `apps/api` | NestJS REST API — single source of truth, PostgreSQL + Redis |
| `apps/bot` | discord.js v14 bot — talks only to the API |
| `apps/web` | Next.js dashboard — Discord OAuth, admin views |
| `packages/shared` | Shared Zod schemas and types |

## VPS / full Docker stack

On a fresh Ubuntu server with Docker:

```bash
chmod +x setup.sh
./setup.sh
```

That creates `.env`, starts Postgres, Redis, API, worker, bot, and web (`docker-compose.yml`). The API container runs **`prisma migrate deploy`** before boot. See [docs/runbooks/production-deploy.md](docs/runbooks/production-deploy.md).

### Deploy updates on an existing VPS

From the server, in your git clone (same directory as `docker-compose.yml`):

```bash
chmod +x scripts/vps-update.sh
DEPLOY_BRANCH=main ./scripts/vps-update.sh
```

### Cursor: auto-commit and push after each agent reply

The project includes [`.cursor/hooks.json`](.cursor/hooks.json): when the Cursor agent finishes a response, it runs `node .cursor/hooks/auto-git-push.mjs`, which commits all pending changes and `git push`es the current branch (if any). Requires non-interactive `git push` (SSH agent or credential helper). To disable, create an empty file `.cursor/no-autopush` or set environment variable `CURSOR_AUTO_PUSH=0`. The hook prints short VPS follow-up steps to the Hooks output when a push succeeds.

After a reboot or deploy, verify the stack:

```bash
chmod +x validate-deployment.sh && ./validate-deployment.sh
```

Operational debugging: [docs/runbooks/operations-and-recovery.md](docs/runbooks/operations-and-recovery.md).

To bring the stack up manually (after configuring `.env` for Docker hostnames `postgres` / `redis` / `api`):

```bash
docker compose up -d --build
```

## Prerequisites

- Node.js 20+
- pnpm (`npx pnpm@9.15.0` works if pnpm is not installed globally)
- PostgreSQL 16 and Redis 7 (Docker Compose file included)

## Quick start (local)

1. Copy environment template:

   ```bash
   copy .env.example .env
   ```

   Use the same `BOT_API_KEY` for the API and bot, and the same `DASHBOARD_JWT_SECRET` for the API and web app. Assign `ADMIN_DISCORD_IDS` **or** rely on `platform_accounts` (see seed) for dashboard `ADMIN` RBAC.

2. Start **infrastructure only** (Postgres + Redis):

   ```bash
   docker compose up -d postgres redis
   ```

3. Install dependencies and migrate:

   ```bash
   pnpm install
   pnpm --filter @protect/api exec prisma migrate deploy
   ```

4. Seed sample data (optional; creates `PlatformAccount` ADMIN + trusted user):

   ```bash
   pnpm db:seed
   ```

5. Run core services (**four** terminals for the full report/outbox/event loop — web dashboard optional):

   ```bash
   pnpm --filter @protect/api dev
   pnpm --filter @protect/worker dev
   pnpm --filter @protect/bot dev
   pnpm --filter @protect/web dev
   ```

   The worker claims **`outbox_events`** and publishes domain envelopes to Redis (pub/sub + stream). Without it, events stay queued and downstream consumers never see them.

6. **Integration tests** (real Postgres + Redis; see env vars in [docs/e2e-local.md](docs/e2e-local.md)):

   ```bash
   pnpm --filter @protect/api test:integration
   ```

   Use `SKIP_INTEGRATION=true` when `DATABASE_URL` / `REDIS_URL` are not available. For read-only API behavior without Redis, see `REDIS_OPTIONAL` in [docs/e2e-local.md](docs/e2e-local.md).

## HTTP routes and versioning

Business APIs live under **`/v1`** (e.g. `GET /v1/user/:id`). **`GET /health`** and **`GET /ready`** stay at the root for load balancers.

- API OpenAPI: http://localhost:3001/docs
- Integrations stub: `GET /v1/integrations/status` (future FiveM / Minecraft clients)
- Web app resolves `API_BASE_URL` to `.../v1` automatically if the path is omitted.

## Discord setup

- **Bot:** Enable **Server Members Intent** in the Discord Developer Portal for `GuildMemberAdd` and member lookups.
- **OAuth (web):** Redirect URL: `NEXTAUTH_URL` + `/api/auth/callback/discord`.
- Slash commands register on bot startup.

**Optional:** set `REDIS_URL` for the bot to subscribe to Redis pub/sub (`protect:user.*`, `protect:server.config.updated`) and invalidate local server-config cache.

## Security and RBAC

- **BOT** — `x-api-key` matching `BOT_API_KEY`.
- **Dashboard users** — `Authorization: Bearer` JWT (`sub` = Discord snowflake), signed with `DASHBOARD_JWT_SECRET`.
- Effective roles: **ADMIN** (`platform_accounts.role` or legacy `ADMIN_DISCORD_IDS`), **TRUSTED** (`trusted_users`), **USER** (default), **BOT** (API key).

Guards: `BotOrJwtGuard` (identity) + `RbacGuard` + `@RequireRoles(...)` per route.

## Domain events (Redis Pub/Sub)

The API publishes JSON envelopes on:

- `protect:user.flagged`
- `protect:user.reported`
- `protect:user.updated`
- `protect:server.config.updated`

The bot can subscribe (when `REDIS_URL` is set) to refresh cached guild config. Delivery is at-most-once.

## Reports: scores and abuse controls

Community reports insert a low-weight `Flag` (`COMMUNITY_REPORT`) after Redis/database dedupe, per-reporter cooldown, and daily caps (see `REPORT_*` env vars in `.env.example`).

## Architecture rules

- Only `apps/api` uses Prisma / `DATABASE_URL`.
- Bot and web call the **versioned** JSON API under `/v1`.
- User profiles use Redis cache-aside (`user:{discordId}`) plus optional short negative caching for unknown CLEAN profiles. Bot `GET /v1/user/:id` may send **`x-protect-skip-user-cache`** (bot key only) so `/check` reads through to Postgres.

## Internal cache consistency (ops)

- **`GET /internal/cache/user/:discordId/validate`** — compare DB flags/scores, optional Redis public JSON (admin JWT).
- **`POST /internal/cache/user/:discordId/repair`** — `UsersService.refreshPublicCache` for that user (admin JWT).

## Observability

- **Worker** logs JSON lines on successful dispatch and on dispatch failure (`eventId`, `type`, `correlationId`, `outboxStatus`, `instanceId`).
- **Bot** logs one JSON **info** line per event (`eventId`, `type`, `guildId`); `user.*` events without `guildId` log a **debug** line (expected — no server config invalidation).
- **API**: set **`LOG_OUTBOX_DEBUG=true`** for debug logs when outbox rows are enqueued (includes `outboxEventId` for single enqueue).

## Production notes

- Worker/outbox tuning and backpressure: [docs/runbooks/worker-recovery.md](docs/runbooks/worker-recovery.md) (`API_OUTBOX_REJECT_THRESHOLD`, batch sizes, idempotent dispatch).

- **API exposure:** With root `docker-compose.yml`, the API publishes **`127.0.0.1:$API_PUBLISH_PORT`** only (not on `0.0.0.0`). Reach it from other containers via `http://api:3001`; avoid a **public DNS** like `https://api.example.com` unless you front it with a locked-down reverse proxy. `/integrations/status` and `/metrics` require **`x-api-key` (bot)** or **dashboard JWT** (`BOT_API_KEY`, `DASHBOARD_JWT_SECRET`). In **`NODE_ENV=production`**, CORS defaults to **off** unless you set **`CORS_ORIGINS`** (comma list); the dashboard normally calls the API **server-side**, so browsers do not need CORS. **`/docs` (Swagger)** is **disabled in production** unless you set **`SWAGGER_ENABLED=true`**.
- Run `pnpm run build` then `node dist/main.js` (API/bot) or `pnpm start` in `apps/web`.
- Use strong secrets and terminate TLS at your edge for user-facing apps (dashboard).
- `api_clients` table is reserved for future scoped API keys (game servers, resellers).
