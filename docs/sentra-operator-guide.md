# Sentra / Protect operator guide

Single-page reference: where to configure things, who is admin, Discord bot behavior, and slash-command registration.

## URLs and dashboard

- **Dashboard (Next.js):** sign in with Discord; manage flagged users, **server configuration**, audit log, and reports. Paths: `/dashboard`, `/dashboard/welcome` (start guide), `/dashboard/server-setup` (servers + config), `/dashboard/config`, `/dashboard/reports`, `/dashboard/audit`.

## First 10 minutes (new server)

Use this as the same order as the in-app **Start guide** (`/dashboard/welcome`):

1. **Invite the bot** with the channel and role permissions described later in this guide (add moderation perms if you use join hold).
2. **License** — a platform admin makes the guild **ACTIVE** or **TRIAL** (`/sentra platform license` or your billing/admin workflow).
3. **Staff feed (recommended)** — set `DISCORD_ADMIN_FEED_CHANNEL_ID` on the bot so **pending** community reports are copied to a private staff channel.
4. **Alert channel & minimum level** — in the dashboard under **Server setup**, or in Discord with `/sentra config` (requires **Manage Server**).
5. **Smoke test** — ensure reporters have the Sentra **User** role where required, then submit `/sentra report` and confirm it appears in **Admin → Reports queue** (and the ops feed if configured).

For licensing and who may report, see **[Sentra licensing & roles](runbooks/sentra-licensing-policy.md)**.
- **API:** application routes live under `https://your-api-host/v1/...` (see Swagger at `/docs` on the API host). Health: `/health`, `/ready` (no `/v1` prefix).

### Production checklist (Sentra.gg)

| Variable | Example | Note |
|----------|---------|------|
| `NEXTAUTH_URL` / `WEB_URL` | `https://dashboard.sentra.gg` | Must match the host users open in the browser (OAuth callback). |
| `AUTH_SECRET` (or `NEXTAUTH_SECRET`, or reuse `DASHBOARD_JWT_SECRET`) | openssl rand | Missing secret → Auth.js “server configuration” error on sign-in. |
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

- The bot registers **only `/sentra`** (subcommands for check, report, flag, config, setup, platform admin, …). Legacy top-level commands (`/check`, `/report`, …) are **not** registered; if an old client still shows them during propagation, using them replies with a pointer to `/sentra`.
- **Global mode** (`DISCORD_GUILD_ID` empty): clears **guild**-scoped command lists (for every guild the bot is in), then registers **global** `/sentra` only.
- **Guild mode** (`DISCORD_GUILD_ID` set + `DISCORD_SLASH_SCOPE=guild`): clears **global** commands and every guild’s list, then registers **`/sentra` only** on that guild id (dev / instant updates).

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

Ensure `.env` has correct `WEB_URL` / `NEXTAUTH_URL` / `AUTH_URL` (dashboard host), `AUTH_SECRET`, `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`, `NEXT_PUBLIC_API_URL` / `API_PUBLIC_URL` (public `https://api…`), and internal `API_BASE_URL=http://api:3001` for web/bot in Compose.

**OAuth / `?error=Configuration`:** often fixed by (1) **excluding `/api/auth` from Next.js middleware** so `auth()` does not run on Edge for those routes (this repo’s `apps/web/middleware.ts` does that), (2) passing `AUTH_SECRET` + Discord keys as **`web` image build args** so Edge middleware matches runtime secrets for `/dashboard` (see `docker-compose.yml` + `apps/web/Dockerfile`).

If the browser shows **Caddy’s default page** instead of the app, follow **[VPS domain and TLS (Caddy)](runbooks/vps-domain-ssl-caddy.md)** and run `./scripts/verify-vps-routing.sh` on the server.

Licensing, pending reports, and member sync: **[Sentra licensing & roles](runbooks/sentra-licensing-policy.md)**. Live Redis event stream: **[sentra-live-tail](runbooks/sentra-live-tail.md)**.

## Bot capabilities (summary)

- **`/sentra check`**, **`/sentra report`**, **`/sentra flag`** — reputation and intake (API enforces trust for flags).
- **`/sentra help`** / **`/sentra support`** — short command list + ticket/dashboard links (`WEB_URL` on the bot).
- **`/sentra setup`** — one short checklist (license, `/sentra config`, permissions). Details live in this guide + help.
- **`/sentra config`** — **`show`** / **`set`** alert channel and minimum level; requires **Manage Server** or **Administrator** on the guild.
- **Platform admin** (your Discord ID in `ADMIN_DISCORD_IDS`): **`/sentra platform`** (license, sync-members), **`/sentra staff`** subcommands (**`approve`** — requires **`report_id`** + **`level`**, **`reject`**, **`reports_pending`**, **`unflag`**), **`/sentra report_status`**.
- **Guild member join** — optional alerts using saved server config.
- **Presence** — bot activity from `GET /v1/bot/public-stats` (aggregate counts only).
- **Redis** (if configured) — subscriber refreshes server config cache and delivers events to Discord.

### Pending reports inbox (Discord)

When **`DISCORD_ADMIN_FEED_CHANNEL_ID`** is set, new **pending** community reports are posted to that channel. Staff still apply the final tier in the **dashboard → Admin → Reports queue** (or **`/sentra staff approve`** with **`level`**).

## API routes (reference)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/v1/bot/public-stats` | `x-api-key` | Counts for bot presence (`usersTracked`, `serversActive`). |
| `POST` | `/v1/bot/server/config` | `x-api-key` | Bot proxy for guild config; body includes `actorDiscordId` (admin who ran `/sentra config` in Discord). |
| `GET` | `/v1/servers` | Bearer (admin JWT) | List configured guilds for the dashboard. |
| `POST` | `/v1/server/config` | Bearer (admin JWT) | Dashboard server configuration. |

## Dashboard OAuth

The dashboard requests Discord scope **`guilds`** so admins get **datalist suggestions** for guilds where they have **Manage Server** (or Administrator). After upgrading from an older deployment, operators may need to **sign out and sign in again** so the token includes guild membership.
