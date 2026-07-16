import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../types';

const PREMIUM_COMMANDS = ['ai', 'backup', 'stats', 'schedule', 'honeypot'];

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche la liste complète des commandes interactives d\'OMNIX.'),

  async execute({ interaction, guildConfig }) {
    const client = interaction.client as any;
    const commandsList = client.commands;

    const helpEmbed = new EmbedBuilder()
      .setTitle('📚 CENTRE D\'AIDE — COMMANDES OMNIX')
      .setDescription('Voici l\'index des commandes actives sur ce serveur. Les commandes Premium nécessitent une licence active.')
      .setColor(0x06b6d4)
      .setTimestamp();

    let standardCommandsText = '';
    let premiumCommandsText = '';

    commandsList.forEach((cmd: any) => {
      const isPremium = PREMIUM_COMMANDS.includes(cmd.data.name);
      const commandLine = `\`/${cmd.data.name}\` - ${cmd.data.description}\n`;
      
      if (isPremium) {
        premiumCommandsText += `💎 ${commandLine}`;
      } else {
        standardCommandsText += `🔹 ${commandLine}`;
      }
    });

    helpEmbed.addFields(
      { name: '⚙️ Commandes Utilitaires & Communauté', value: standardCommandsText || 'Aucune commande.', inline: false },
      { name: '👑 Fonctionnalités Premium d\'OMNIX', value: premiumCommandsText || 'Aucune commande.', inline: false }
    );

    return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  }
} as Command;