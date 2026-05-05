import type { Client, EmbedBuilder, TextChannel } from 'discord.js';
import type { Env } from '../config/env';
import { botLog } from '../log';

export async function sendAdminFeedEmbed(
  client: Client,
  env: Env,
  embed: EmbedBuilder,
): Promise<void> {
  const chId = env.DISCORD_ADMIN_FEED_CHANNEL_ID;
  if (!chId) return;
  try {
    const ch = await client.channels.fetch(chId);
    if (!ch || !('send' in ch)) return;
    await (ch as TextChannel).send({ embeds: [embed] });
  } catch (e) {
    botLog('warn', 'admin_feed_send_failed', { error: String(e) });
  }
}
