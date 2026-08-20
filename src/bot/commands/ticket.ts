import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';

import {
  getGuildConfig,
} from '../utils/guildConfig.ts';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription(
      'Gère le système de tickets OMNIX.'
    )
    .addSubcommand(
      sub =>
        sub
          .setName('setup')
          .setDescription(
            'Configure le système de tickets.'
          )
    )
    .addSubcommand(
      sub =>
        sub
          .setName('status')
          .setDescription(
            'Affiche le statut du système de tickets.'
          )
    ),

  async execute(
    interaction: any
  ) {
    /* =====================================================
       SERVEUR
    ===================================================== */

    if (!interaction.guildId) {
      await interaction.reply({
        content:
          '❌ Cette commande doit être utilisée sur un serveur.',
        flags: 64,
      });

      return;
    }

    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const {
      config,
    } = await getGuildConfig(
      interaction.guildId
    );

    const tickets =
      config.modules?.tickets;

    const subcommand =
      interaction.options.getSubcommand();

    /* =====================================================
       STATUS
    ===================================================== */

    if (
      subcommand ===
      'status'
    ) {
      const embed =
        new EmbedBuilder()
          .setTitle(
            '🎫 Système de tickets'
          )
          .setDescription(
            'Voici la configuration actuelle des tickets pour ce serveur.'
          )
          .addFields(
            {
              name:
                'Statut',
              value:
                tickets?.enabled
                  ? '🟢 Activé'
                  : '🔴 Désactivé',
              inline: true,
            },
            {
              name:
                'Catégorie',
              value:
                tickets?.categoryId
                  ? `<#${tickets.categoryId}>`
                  : 'Non configurée',
              inline: true,
            },
            {
              name:
                'Rôle support',
              value:
                tickets?.supportRoleId
                  ? `<@&${tickets.supportRoleId}>`
                  : 'Non configuré',
              inline: true,
            }
          )
          .setTimestamp();

      await interaction.reply({
        embeds: [
          embed,
        ],
      });

      return;
    }

    /* =====================================================
       SETUP
    ===================================================== */

    if (
      subcommand ===
      'setup'
    ) {
      /*
       * Vérification permissions.
       */

      if (
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        await interaction.reply({
          content:
            '❌ Tu dois avoir la permission **Gérer le serveur** pour configurer les tickets.',
          flags: 64,
        });

        return;
      }

      /*
       * Création automatique d'une catégorie
       * si elle n'existe pas.
       */

      let category =
        tickets?.categoryId
          ? interaction.guild.channels.cache.get(
              tickets.categoryId
            )
          : null;

      if (
        !category
      ) {
        category =
          await interaction.guild.channels.create(
            {
              name:
                '🎫・TICKETS',

              type:
                ChannelType.GuildCategory,
            }
          );
      }

      /*
       * Mise à jour MongoDB.
       */

      config.modules.tickets.enabled =
        true;

      config.modules.tickets.categoryId =
        category.id;

      await config.save();

      const embed =
        new EmbedBuilder()
          .setTitle(
            '🎫 Tickets configurés'
          )
          .setDescription(
            'Le système de tickets OMNIX est maintenant activé sur ce serveur.'
          )
          .addFields({
            name:
              'Catégorie',
            value:
              `<#${category.id}>`,
          })
          .setTimestamp();

      await interaction.reply({
        embeds: [
          embed,
        ],
      });

      return;
    }
  },
};