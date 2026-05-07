import { EmbedBuilder, type ColorResolvable } from 'discord.js';
import { flagLevelDisplayName, shouldAlertUserLevel } from '@protect/shared';
import {
  SENTRA_DANGER,
  SENTRA_PRIMARY,
  SENTRA_SUCCESS,
  SENTRA_WARNING,
  baseCommandEmbed,
} from '../embeds/sentra';

const levelColors: Record<string, ColorResolvable> = {
  CLEAN: SENTRA_SUCCESS,
  WATCH: 0x9b59b6,
  SUSPICIOUS: SENTRA_WARNING,
  HIGH_RISK: 0xe67e22,
  CONFIRMED_CHEATER: SENTRA_DANGER,
};

export function shouldAlert(
  userLevel: string,
  minLevel: string | undefined,
): boolean {
  return shouldAlertUserLevel(userLevel, minLevel);
}

const LEVEL_PRESENTATION: Record<
  string,
  { emoji: string; headline: string }
> = {
  CLEAN: { emoji: '🟢', headline: '**Veilig**' },
  WATCH: { emoji: '👀', headline: '**Let op**' },
  SUSPICIOUS: { emoji: '⚠️', headline: '**Verdacht**' },
  HIGH_RISK: { emoji: '🔶', headline: '**Hoog risico**' },
  CONFIRMED_CHEATER: { emoji: '🚫', headline: '**Cheater**' },
};

/** Rich status lines (emoji + bold) for checks, alerts, and join hold. */
export function buildStatusDescription(
  user: { discordId: string; flagLevel: string },
  contextLine?: string,
): string {
  const preset = LEVEL_PRESENTATION[user.flagLevel];
  const label = flagLevelDisplayName(user.flagLevel);
  const headline = preset ? `${preset.emoji} ${preset.headline}` : `❔ **${label}**`;
  const sub = preset ? `_(${label})_` : '';
  const lines = [
    contextLine?.trim() ?? null,
    headline,
    sub,
    '',
    `👤 **Account** · <@${user.discordId}>`,
  ].filter((l) => l != null && l !== '');
  return lines.join('\n');
}

export function userStatusEmbed(
  user: { discordId: string; flagLevel: string; flagScore: number; flagCount?: number },
  title: string,
  opts?: { authorTag?: string; authorIconUrl?: string },
): EmbedBuilder {
  const color = levelColors[user.flagLevel] ?? SENTRA_PRIMARY;
  const b = baseCommandEmbed(color)
    .setTitle(title)
    .setDescription(buildStatusDescription(user));
  const tag = opts?.authorTag?.trim();
  const icon = opts?.authorIconUrl?.trim();
  if (tag && icon) b.setAuthor({ name: tag, iconURL: icon });
  else if (tag) b.setAuthor({ name: tag });
  return b;
}

export function alertEmbed(
  user: { discordId: string; flagLevel: string; flagScore: number },
  context: string,
): EmbedBuilder {
  const color = levelColors[user.flagLevel] ?? SENTRA_PRIMARY;
  return baseCommandEmbed(color)
    .setTitle('🛡️ Alert')
    .setDescription(buildStatusDescription(user, `📌 ${context}`));
}
