# Sentra / Protect operator guide

Single-page reference: where to configure things, who is admin, Discord bot behavior, and slash-command registration.

## URLs and dashboard

- **Dashboard (Next.js):** sign in with Discord; manage flagged users, **server configuration**, audit log. Paths: `/dashboard`, `/dashboard/config`, `/dashboard/audit`.
- **API:** application routes live under `https://your-api-host/v1/...` (see Swagger at `/docs` on the API host). Health: `/health`, `/ready` (no `/v1` prefix).

### Production checklist (Sentra.gg)

| Variable | Example | Note |
|----------|---------|------|
| `NEXTAUTH_URL` / `WEB_URL` | `https://dashboard.sentra.gg` | Must match the host users open in the browser (OAuth callback). |
| `NEXT_PUBLIC_API_URL` / `API_PUBLIC_URL` | `https://api.sentra.gg` | Browser calls the API here; not `localhost`. |
| `API_BASE_URL` (web + bot in Docker) | `http://api:3001` | Internal Compose network only. |

**Discord Developer Portal → OAuth2 → Redirects:** add exactly:

`https://dashboard.sentra.gg/api/auth/callback/discord`

**Apex (`sentra.gg`):** Prefer a **301 redirect** to `https://dashboard.sentra.gg` in your reverse proxy so cookies and Discord callbacks stay on one host — see `infra/caddy/Caddyfile.example`. Alternatively, proxy apex to the same app and set `NEXT_PUBLIC_APEX_HOSTS` + `NEXT_PUBLIC_APP_ORIGIN` in `.env`, then **rebuild** the `web` image.

**Cloudflare:** If Caddy cannot obtain Let’s Encrypt certificates (orange-cloud “proxied” mode), use **DNS only** for the hostnames, or use Cloudflare Origin Certificate / DNS-01.

## Who can change what

- **Dashboard `POST /v1/server/config`:** requires **ADMIN** (not just “logged in”). Admins are resolved in the API from:
  - `ADMIN_DISCORD_IDS` (comma-separated Discord user snowflakes in env), and/or
  - `platform_accounts` row with `role = ADMIN` for that Discord user (see Prisma seed).
- **Bot** uses `x-api-key` (`BOT_API_KEY` / `API_KEY` in `.env`) for JSON routes under `/v1/...`.

## Servers are not “added” in Discord

There is no separate “register server” step. When an **admin** saves config for a `guildId`, the API **upserts** a row in `servers`. Until then, the guild may not appear in lists.

Configure **alert channel** and **minimum flag level** in the dashboard (Server config) or via API.

## Slash commands and `DISCORD_GUILD_ID`

On each **Discord ready**, the bot **reconciles** commands so you should only see **one** set per guild:

- **Global mode** (`DISCORD_GUILD_ID` empty): clears **all global** definitions’ competing **guild** command lists (for every guild the bot is currently in), then registers **global** commands only. That removes old guild-scoped copies that were stacking with global (duplicate `/report`, etc.).
- **Guild mode** (`DISCORD_GUILD_ID` set): clears **global** commands, clears **guild** command lists for every guild in cache, then registers commands **only** on that guild id (dev / single-guild instant updates).

Sync runs **after** the gateway connection is ready so the guild list is known. Very large guild counts add a short startup delay due to per-guild API calls.

| `.env` | Behavior |
|--------|----------|
| `DISCORD_GUILD_ID` **empty** | **Global** commands — all servers; initial Discord sync can take up to ~1 hour for some clients. |
| `DISCORD_GUILD_ID` **set** | **Guild-only** for that id — instant in that guild; others have no commands until you switch back to global. |

**Production / multi-guild:** leave `DISCORD_GUILD_ID` empty.

### If duplicates still appear

Restart the bot after deploy so reconciliation runs. Client-side, try reloading Discord (Ctrl+R). Rarely, wait for global command propagation.

## After deploy on the VPS

```bash
cd ~/protect-platform
git pull origin main
docker compose up -d --build
./validate-deployment.sh
```

Ensure `.env` has correct `WEB_URL` / `NEXTAUTH_URL` (dashboard host), `NEXT_PUBLIC_API_URL` / `API_PUBLIC_URL` (public `https://api…`), and internal `API_BASE_URL=http://api:3001` for web/bot in Compose. After changing `NEXT_PUBLIC_*`, run `docker compose up -d --build web`.

If the browser shows **Caddy’s default page** instead of the app, follow **[VPS domain and TLS (Caddy)](runbooks/vps-domain-ssl-caddy.md)** and run `./scripts/verify-vps-routing.sh` on the server.

## Bot capabilities (summary)

- **`/check`**, **`/report`**, **`/flag`** — reputation and intake (API enforces trust for flags).
- **`/help`** — short command list and dashboard link (uses `WEB_URL` in the bot container if set).
- **`/config`** — **`view`** / **`set`** alert channel and minimum level; requires **Manage Server** or **Administrator** on the guild (writes via `POST /v1/bot/server/config`).
- **Guild member join** — optional alerts using saved server config.
- **Presence** — bot sets activity from `GET /v1/bot/public-stats` (user + server counts); no PII.
- **Redis** (if configured) — subscriber refreshes server config cache; no extra Discord messages from that path alone.

## API routes (reference)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/v1/bot/public-stats` | `x-api-key` | Counts for bot presence (`usersTracked`, `serversActive`). |
| `POST` | `/v1/bot/server/config` | `x-api-key` | Bot proxy for guild config; body includes `actorDiscordId` (admin who ran `/config` in Discord). |
| `GET` | `/v1/servers` | Bearer (admin JWT) | List configured guilds for the dashboard. |
| `POST` | `/v1/server/config` | Bearer (admin JWT) | Dashboard server configuration. |

## Dashboard OAuth

The dashboard requests Discord scope **`guilds`** so admins get **datalist suggestions** for guilds where they have **Manage Server** (or Administrator). After upgrading from an older deployment, operators may need to **sign out and sign in again** so the token includes guild membership.
