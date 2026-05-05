/** Discord guild `permissions` bitfield as string (from OAuth /guilds). */
export function canManageGuildDiscordPermissions(permissions: string): boolean {
  try {
    const p = BigInt(permissions);
    const MANAGE_GUILD = 1n << 5n;
    const ADMIN = 1n << 3n;
    return (p & ADMIN) === ADMIN || (p & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}
