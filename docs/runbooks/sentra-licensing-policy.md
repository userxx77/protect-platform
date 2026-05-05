# Sentra licensing, roles, and admin feed

## Tiers (summary)

| Tier | Discord | API / dashboard |
|------|---------|-----------------|
| **Public** | Bot can be invited; `/config` still updates alert settings via existing bot→API path (subject to your future stricter gating). | No dashboard scope by default. |
| **Licensed guild** | `GuildEntitlement` is **ACTIVE** or **TRIAL** with `validFrom` / `validUntil` in range. | Community `/report` via bot creates a **pending** report (no flag) until a platform **ADMIN** approves in the dashboard. |
| **Trusted / platform ADMIN** (reporter) | `/report` applies the flag immediately (same as previous product behavior for trusted paths). | Full admin APIs and pages. |

## Environment (bot)

| Variable | Purpose |
|----------|---------|
| `DISCORD_ADMIN_FEED_CHANNEL_ID` | Optional. Text channel ID where the bot posts embeds for **pending reports**, **guild discovered**, and (via Redis) **member sync** is driven. |

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

## Migrations

After deploy, from repo root (or `apps/api`):

```bash
npx prisma migrate deploy
```

New migration: `20260505140000_sentra_entitlements_reports` — adds `guild_entitlements`, `guild_member_cache`, extends `servers` and `reports`, backfills **ACTIVE** entitlement for existing `servers` rows.
