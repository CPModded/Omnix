/**
 * ====================================================================
 * COMMANDE DE SÉCURITÉ HONEYPOT (OMNIX SECURITY CORE)
 * ====================================================================
 */

import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionFlagsBits as DiscordPermissions } from 'discord.js';
import { Command, CommandContext } from '../types';
import { GuildConfig } from '../../models/GuildConfig';

const honeypotCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('honeypot')
    .setDescription('Gérer le système de sécurité anti-bots (Honeypot - Premium)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Créer et configurer automatiquement le salon piégé')
        .addStringOption(opt => opt.setName('name').setDescription('Nom du salon (ex: verify-here)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription("Afficher l'état d'activité du Honeypot") // Correction des guillemets pour éviter le crash
    ) as any,

  async execute({ interaction, guildConfig }: CommandContext) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    // Vérification de l'activation du module
    if (!guildConfig.modules.honeypot?.enabled) {
      return interaction.reply({
        content: "❌ Le module Honeypot n'est pas activé sur ce serveur. Activez-le sur la console d'OMNIX.",
        ephemeral: true
      });
    }

    // 1. SOUS-COMMANDE : CONFIGURATION DU PIÈGE
    if (subcommand === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      const channelName = interaction.options.getString('name', true).toLowerCase().replace(/\s+/g, '-');

      try {
        const trapChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              allow: [DiscordPermissions.ViewChannel, DiscordPermissions.SendMessages, DiscordPermissions.ReadMessageHistory]
            }
          ]
        });

        guildConfig.modules.honeypot.channelId = trapChannel.id;
        await guildConfig.save();

        await trapChannel.send({
          content: "⚠️ **SALON DE SÉCURITÉ OMNIX**\n*L'écriture ou l'interaction dans ce salon est interdite aux utilisateurs normaux sous peine de bannissement définitif.*"
        });

        return interaction.editReply({
          content: `✅ **Honeypot activé et configuré !**\n• Salon piégé créé : ${trapChannel}\n• Tout robot de raid ou self-bot tentant d'y écrire sera **banni immédiatement**.`
        });

      } catch (error: any) {
        console.error('[Honeypot Error] Setup failed :', error.message);
        return interaction.editReply({
          content: "❌ Impossible de créer le salon de sécurité. Vérifiez mes permissions d'administration."
        });
      }
    }

    // 2. SOUS-COMMANDE : ÉTAT DU MODULE
    if (subcommand === 'status') {
      const channelId = guildConfig.modules.honeypot.channelId;
      const statusText = channelId 
        ? `Actif (Salon piégé : <#${channelId}>)` 
        : 'Inactif (En attente de configuration via `/honeypot setup`)';

      return interaction.reply({
        content: `🛡️ **Statut du système Honeypot OMNIX :**\n• État : \`${statusText}\``,
        ephemeral: true
      });
    }
  }
};

export default honeypotCommand;