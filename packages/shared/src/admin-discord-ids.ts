/** Same semantics as API `ADMIN_DISCORD_IDS` env: comma-separated Discord snowflakes. */

export function parseAdminDiscordIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isDiscordPlatformAdmin(
  discordUserId: string,
  rawList: string | undefined,
): boolean {
  return parseAdminDiscordIds(rawList).includes(discordUserId);
}
