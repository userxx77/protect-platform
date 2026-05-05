# Sentra / Protect operator guide

Single-page reference: where to configure things, who is admin, Discord bot behavior, and slash-command registration.

## URLs and dashboard

- **Dashboard (Next.js):** sign in with Discord; manage flagged users, **server configuration**, audit log. Paths: `/dashboard`, `/dashboard/config`, `/dashboard/audit`.
- **API:** application routes live under `https://your-api-host/v1/...` (see Swagger at `/docs` on the API host). Health: `/health`, `/ready` (no `/v1` prefix).

## Who can change what

- **Dashboard `POST /v1/server/config`:** requires **ADMIN** (not just “logged in”). Admins are resolved in the API from:
  - `ADMIN_DISCORD_IDS` (comma-separated Discord user snowflakes in env), and/or
  - `platform_accounts` row with `role = ADMIN` for that Discord user (see Prisma seed).
- **Bot** uses `x-api-key` (`BOT_API_KEY` / `API_KEY` in `.env`) for JSON routes under `/v1/...`.

## Servers are not “added” in Discord

There is no separate “register server” step. When an **admin** saves config for a `guildId`, the API **upserts** a row in `servers`. Until then, the guild may not appear in lists.

Configure **alert channel** and **minimum flag level** in the dashboard (Server config) or via API.

## Slash commands and `DISCORD_GUILD_ID`

The bot registers **either** global **or** guild scoped commands (never both), so you do not get duplicate `/check`, `/report`, `/flag` in one guild.

| `.env` | Behavior |
|--------|----------|
| `DISCORD_GUILD_ID` **empty** | **Global** commands — all servers; Discord can take up to ~1 hour to sync new/updated commands. |
| `DISCORD_GUILD_ID` **set** | **Guild-only** commands for that id — instant, but **only that guild** sees the commands. |

**Production / multi-guild:** leave `DISCORD_GUILD_ID` empty after you no longer need instant dev registration.

### Cleaning up old duplicate guild commands (one-time)

If you previously had duplicates from an older build:

1. Deploy the current bot image, then in the [Discord Developer Portal](https://discord.com/developers/applications) restart or clear application commands for the test guild if needed, **or**
2. Call Discord’s REST API: `PUT /applications/{app.id}/guilds/{guild.id}/commands` with body `[]` to clear guild commands, then restart the bot so it re-registers a single set.

## After deploy on the VPS

```bash
cd ~/protect-platform
git pull origin main
docker compose up -d --build
./validate-deployment.sh
```

Ensure `.env` has correct `WEB_URL` / `NEXTAUTH_URL` (dashboard), `NEXT_PUBLIC_API_URL` / `API_PUBLIC_URL`, and internal `API_BASE_URL=http://api:3001` for web/bot in Compose.

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
