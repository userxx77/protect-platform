import type { ChatInputCommandInteraction } from 'discord.js';
import { embedNeedGuild, embedSetupStart } from '../embeds/commandEmbeds';

/** Single `/sentra setup` — short checklist; details live in `/sentra help` + operator docs. */
export async function executeSetupQuick(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ ephemeral: true, embeds: [embedNeedGuild()] });
    return;
  }
  const guildName = interaction.guild?.name ?? 'this server';
  await interaction.reply({ ephemeral: true, embeds: [embedSetupStart(guildName)] });
}
