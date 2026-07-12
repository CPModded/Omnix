import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../types';

const pingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Répond par Pong et indique le statut de l\'offre premium locale'),

  async execute({ interaction, guildConfig }: CommandContext) {
    const isPremium = guildConfig.premium.isPremium;
    const tierName = guildConfig.premium.tier.toUpperCase();

    const text = isPremium 
      ? `Ce serveur dispose de l'offre **${tierName}**.` 
      : "Ce serveur utilise actuellement la version d'évaluation standard.";

    await interaction.reply({
      content: `🏓 Pong ! Latence API : ${interaction.client.ws.ping}ms.\nConfiguration : ${text}`,
      ephemeral: true
    });
  }
};

export default pingCommand;