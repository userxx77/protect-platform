/** Same rules as API `ADMIN_DISCORD_IDS` (comma-separated Discord snowflakes). */
export function isPlatformAdminDiscordId(discordUserId: string | undefined): boolean {
  if (!discordUserId) return false;
  const raw = process.env.ADMIN_DISCORD_IDS;
  if (!raw) return false;
  const set = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return set.has(discordUserId);
}
