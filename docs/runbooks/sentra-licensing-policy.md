# Sentra licensing, roles, and admin feed

## Tiers (summary)

| Tier | Discord | API / dashboard |
|------|---------|-----------------|
| **Public** | Bot can be invited; `/sentra config` still updates alert settings via existing bot→API path (subject to your future stricter gating). | No dashboard scope by default. |
| **Licensed guild** | `GuildEntitlement` is **ACTIVE** or **TRIAL** with `validFrom` / `validUntil` in range. | Community `/report` via bot creates a **pending** report (no flag) until a platform **ADMIN** approves in the dashboard. |
| **Trusted / platform ADMIN** (reporter) | `/report` applies the flag immediately (same as previous product behavior for trusted paths). | Full admin APIs and pages. |

## Environment (bot)

| Variable | Purpose |
|----------|---------|
| `DISCORD_ADMIN_FEED_CHANNEL_ID` | Optional. Text channel ID where the bot posts embeds for **pending reports**, **guild discovered**, and (via Redis) **member sync** is driven. |
| `ADMIN_DISCORD_IDS` | Same comma-separated Discord user IDs as API **`ADMIN_DISCORD_IDS`**. Required for **`/sentra platform`** and **`/sentra monitor`** (slash) to authorize platform operators. |

## Environment (API)

| Variable | Purpose |
|----------|---------|
| `SENTRA_AUTO_TRIAL_DAYS` | If set to a positive number, new guild joins (bot lifecycle) get a **TRIAL** entitlement for that many days instead of **INACTIVE** (so community `/report` works without a manual license step). |
| `SENTRA_LICENSED_GUILD_IDS` | Optional comma-separated guild snowflakes always treated as **licensed** for community report gating (manual whitelist). |

## Discord admin slash command

In servers where the bot is present, users with a Discord ID listed in **`ADMIN_DISCORD_IDS`** (bot env, mirroring the API) may run:

- **`/sentra platform license`** — set `guild_id`, `status`, optional `valid_from` / `valid_until` / `plan_code` (calls `POST /v1/bot/admin/guilds/:id/entitlement` with bot key + actor id).
- **`/sentra platform sync-members`** — queue member cache sync (`POST /v1/bot/admin/guilds/:id/sync-members`).

Commands are registered in **global** command scope when `DISCORD_GUILD_ID` is unset (production). With dev guild-only registration, `/sentra` is registered in that same guild scope or temporarily use global registration.

## Stripe (placeholder)

- `POST /v1/webhooks/stripe` accepts requests and returns `{ received: true }`. **Do not** treat this as verified billing yet — add signature verification and map `customer` / `subscription` metadata to `guildId` before trusting.

## Admin operations (JWT + platform ADMIN)

- List guilds + entitlements: `GET /v1/admin/guilds`
- Set entitlement: `POST /v1/admin/guilds/:guildId/entitlement` with `status`, `validFrom`, optional `validUntil`, optional Stripe fields.
- Enqueue member sync (batched uploads from bot): `POST /v1/admin/guilds/:guildId/sync-members`

## User dashboard

- **My servers** resolves licenses for Discord “Manage Server” guilds: `POST /v1/me/guilds/resolve`
- **Member cache** (licensed guilds): `GET /v1/me/guilds/:guildId/members?manageable=id1,id2,...`

Non-admin requests must include their manageable guild ids in `manageable` so the API can enforce scope.

### Cached member identity fields

`guild_member_cache` may store **Discord usernames**, **global display names**, and **avatar hashes** (not full CDN URLs) to power dashboard and operator tooling. This is intentional for support and moderation workflows; avoid retaining rows longer than your product policy requires and restrict database exports accordingly.

## Migrations

After deploy, from repo root (or `apps/api`):

```bash
npx prisma migrate deploy
```

New migration: `20260505140000_sentra_entitlements_reports` — adds `guild_entitlements`, `guild_member_cache`, extends `servers` and `reports`, backfills **ACTIVE** entitlement for existing `servers` rows.
