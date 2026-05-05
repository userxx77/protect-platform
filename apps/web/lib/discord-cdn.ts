/** Discord CDN guild icon URL. */
export function guildIconUrl(guildId: string, iconHash: string | null | undefined): string | null {
  if (!iconHash) return null;
  const ext = iconHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}`;
}

/** User avatar URL; null uses default avatar behavior in UI. */
export function userAvatarUrl(
  userId: string,
  avatarHash: string | null | undefined,
  discriminator = '0',
): string | null {
  if (avatarHash) {
    const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}`;
  }
  const mod = Number(BigInt(userId) >> BigInt(22)) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${mod}.png`;
}
