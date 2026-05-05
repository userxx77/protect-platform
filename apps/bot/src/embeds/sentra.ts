import { EmbedBuilder } from 'discord.js';

export const SENTRA_COLOR = 0x5865f2;

export function baseEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SENTRA_COLOR)
    .setFooter({ text: 'Sentra' })
    .setTimestamp(new Date());
}
