import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';

import {
  getGuildConfig,
} from '../utils/guildConfig.ts';


/* =========================================================
   OMNIX — TICKET COMMAND
========================================================= */

export default {

  data:
    new SlashCommandBuilder()
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

    if (
      !interaction.guildId ||
      !interaction.guild
    ) {

      await interaction.reply({
        content:
          '❌ Cette commande doit être utilisée sur un serveur.',

        flags:
          MessageFlags.Ephemeral,
      });

      return;
    }


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    let config;

    try {

      const result =
        await getGuildConfig(
          interaction.guildId
        );

      config =
        result?.config;

    } catch (error) {

      console.error(
        '[Ticket] Impossible de récupérer la configuration :',
        error
      );

      if (
        interaction.replied ||
        interaction.deferred
      ) {

        await interaction.followUp({
          content:
            '❌ Impossible de récupérer la configuration OMNIX de ce serveur.',

          flags:
            MessageFlags.Ephemeral,
        }).catch(() => {});

      } else {

        await interaction.reply({
          content:
            '❌ Impossible de récupérer la configuration OMNIX de ce serveur.',

          flags:
            MessageFlags.Ephemeral,
        }).catch(() => {});
      }

      return;
    }


    if (!config) {

      await interaction.reply({
        content:
          '❌ La configuration OMNIX de ce serveur est introuvable.',

        flags:
          MessageFlags.Ephemeral,
      });

      return;
    }


    /* =====================================================
       MODULES — SÉCURISÉ
    ===================================================== */

    /*
     * Certaines anciennes GuildConfig peuvent ne pas
     * encore avoir `modules`.
     *
     * On ne fait donc plus :
     *
     *     config.modules.tickets
     *
     * directement.
     */

    const modules =
      config.modules ||
      {};


    const tickets =
      modules.tickets ||
      {};


    /* =====================================================
       SOUS-COMMANDE
    ===================================================== */

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
                tickets.enabled
                  ? '🟢 Activé'
                  : '🔴 Désactivé',

              inline:
                true,
            },

            {
              name:
                'Catégorie',

              value:
                tickets.categoryId
                  ? `<#${tickets.categoryId}>`
                  : 'Non configurée',

              inline:
                true,
            },

            {
              name:
                'Rôle support',

              value:
                tickets.supportRoleId
                  ? `<@&${tickets.supportRoleId}>`
                  : 'Non configuré',

              inline:
                true,
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

      /* ===================================================
         PERMISSIONS
      =================================================== */

      if (
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {

        await interaction.reply({
          content:
            '❌ Tu dois avoir la permission **Gérer le serveur** pour configurer les tickets.',

          flags:
            MessageFlags.Ephemeral,
        });

        return;
      }


      /* ===================================================
         CATÉGORIE EXISTANTE
      =================================================== */

      let category =
        tickets.categoryId
          ? interaction.guild.channels.cache.get(
              tickets.categoryId
            )
          : null;


      /*
       * Si l'ancien ID existe mais que le salon
       * n'existe plus, on recrée automatiquement
       * la catégorie.
       */

      if (
        !category ||
        category.type !==
          ChannelType.GuildCategory
      ) {

        category =
          await interaction.guild.channels.create({
            name:
              '🎫・TICKETS',

            type:
              ChannelType.GuildCategory,
          });
      }


      /* ===================================================
         GARANTIR LA STRUCTURE MODULES/TICKETS
      =================================================== */

      /*
       * IMPORTANT :
       *
       * On ne remplace pas toute la configuration.
       * On crée uniquement les branches manquantes.
       *
       * Cela protège toutes les autres options
       * de GuildConfig.
       */

      if (
        !config.modules
      ) {
        config.modules = {} as any;
      }


      if (
        !config.modules.tickets
      ) {
        config.modules.tickets = {} as any;
      }


      /* ===================================================
         MISE À JOUR
      =================================================== */

      config.modules.tickets.enabled =
        true;

      config.modules.tickets.categoryId =
        category.id;


      /*
       * Ne touche pas au supportRoleId s'il existe déjà.
       */

      if (
        typeof config.modules.tickets.supportRoleId ===
        'undefined'
      ) {

        config.modules.tickets.supportRoleId =
          null;
      }


      await config.save();


      /* ===================================================
         EMBED
      =================================================== */

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


    /* =====================================================
       FALLBACK
    ===================================================== */

    await interaction.reply({
      content:
        '❌ Sous-commande ticket inconnue.',

      flags:
        MessageFlags.Ephemeral,
    });
  },

};