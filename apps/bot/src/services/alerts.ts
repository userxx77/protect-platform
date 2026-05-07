import { EmbedBuilder, type ColorResolvable } from 'discord.js';
import { flagLevelDisplayName } from '@protect/shared';
import {
  SENTRA_DANGER,
  SENTRA_PRIMARY,
  SENTRA_SUCCESS,
  SENTRA_WARNING,
  baseCommandEmbed,
} from '../embeds/sentra';

const levelColors: Record<string, ColorResolvable> = {
  CLEAN: SENTRA_SUCCESS,
  SUSPICIOUS: SENTRA_WARNING,
  HIGH_RISK: 0xe67e22,
  CONFIRMED_CHEATER: SENTRA_DANGER,
};

const levelOrder = ['CLEAN', 'SUSPICIOUS', 'HIGH_RISK', 'CONFIRMED_CHEATER'] as const;

export function shouldAlert(
  userLevel: string,
  minLevel: string | undefined,
): boolean {
  const min = minLevel ?? 'SUSPICIOUS';
  const ui = levelOrder.indexOf(userLevel as (typeof levelOrder)[number]);
  const mi = levelOrder.indexOf(min as (typeof levelOrder)[number]);
  if (mi < 0 || ui < 0) return userLevel !== 'CLEAN';
  return ui >= mi;
}

export function userStatusEmbed(
  user: { discordId: string; flagLevel: string; flagScore: number; flagCount?: number },
  title: string,
): EmbedBuilder {
  const color = levelColors[user.flagLevel] ?? SENTRA_PRIMARY;
  const levelLabel = flagLevelDisplayName(user.flagLevel);
  return baseCommandEmbed(color)
    .setTitle(title)
    .setDescription('Reputation only — verify context before action.')
    .addFields(
      { name: 'User', value: `<@${user.discordId}> · \`${user.discordId}\``, inline: false },
      { name: 'Level', value: levelLabel, inline: true },
      { name: 'Score', value: String(user.flagScore), inline: true },
      {
        name: 'Flags',
        value: user.flagCount != null ? String(user.flagCount) : '—',
        inline: true,
      },
    );
}

export function alertEmbed(
  user: { discordId: string; flagLevel: string; flagScore: number },
  context: string,
): EmbedBuilder {
  const e = userStatusEmbed(user, 'Alert');
  e.setDescription(`${context}\nReputation only — verify before action.`);
  return e;
}
