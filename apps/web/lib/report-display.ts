import { userAvatarUrl } from '@/lib/discord-cdn';

export type ReportMemberDisplayDto = {
  discordUserId: string;
  username: string | null;
  globalName: string | null;
  avatarHash: string | null;
} | null;

/** Primary label for a Discord user in report UIs (Dutch copy). */
export function reportMemberLabel(d: ReportMemberDisplayDto, fallbackDiscordId: string): string {
  if (!d) return 'Onbekende gebruiker';
  const n = d.globalName?.trim() || d.username?.trim();
  if (n) return n;
  return 'Onbekende gebruiker';
}

/** @username if known */
export function reportMemberHandle(d: ReportMemberDisplayDto): string | null {
  if (!d?.username?.trim()) return null;
  return `@${d.username.trim()}`;
}

export function reportAvatarSrc(d: ReportMemberDisplayDto, fallbackDiscordId: string): string {
  const id = d?.discordUserId ?? fallbackDiscordId;
  const hash = d?.avatarHash ?? null;
  return userAvatarUrl(id, hash) ?? userAvatarUrl(fallbackDiscordId, null) ?? '';
}
