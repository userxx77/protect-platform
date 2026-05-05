import { EmbedBuilder, type ColorResolvable } from 'discord.js';
import { SENTRA_PRIMARY, sentraFooter } from '../embeds/sentra';

const levelColors: Record<string, ColorResolvable> = {
  CLEAN: 0x57f287,
  SUSPICIOUS: 0xfee75c,
  HIGH_RISK: 0xed4245,
  CONFIRMED_CHEATER: 0x992d22,
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
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .addFields(
      { name: 'User', value: `<@${user.discordId}> (${user.discordId})`, inline: false },
      { name: 'Level', value: user.flagLevel, inline: true },
      { name: 'Score', value: String(user.flagScore), inline: true },
      {
        name: 'Flags',
        value: user.flagCount != null ? String(user.flagCount) : '—',
        inline: true,
      },
    )
    .setFooter(sentraFooter())
    .setTimestamp(new Date());
}

export function alertEmbed(
  user: { discordId: string; flagLevel: string; flagScore: number },
  context: string,
): EmbedBuilder {
  const e = userStatusEmbed(user, 'Sentra — reputation alert');
  e.setDescription(context);
  return e;
}
