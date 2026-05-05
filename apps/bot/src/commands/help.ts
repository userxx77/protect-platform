import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Env } from '../config/env';
import { embedHelp } from '../embeds/commandEmbeds';

export const helpCommandData = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Sentra commands and dashboard link');

export async function executeHelp(
  interaction: ChatInputCommandInteraction,
  env: Env,
): Promise<void> {
  const dash = env.WEB_URL?.replace(/\/$/, '') ?? 'Configure `WEB_URL` for a dashboard link.';
  await interaction.reply({
    ephemeral: true,
    embeds: [embedHelp(dash)],
  });
}
