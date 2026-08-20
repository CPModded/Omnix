import {
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

import {
  getGuildConfig,
} from '../utils/guildConfig.ts';

export default {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription(
      'Affiche la boutique OMNIX.'
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
       CONFIGURATION SERVEUR
    ===================================================== */

    const {
      config,
    } = await getGuildConfig(
      interaction.guildId
    );

    /* =====================================================
       MODULE ECONOMY
    ===================================================== */

    const economy =
      config.modules?.economy;

    if (
      !economy?.enabled
    ) {
      await interaction.reply({
        content:
          '❌ Le système économique est désactivé sur ce serveur.',
        flags: 64,
      });

      return;
    }

    /* =====================================================
       BOUTIQUE
    ===================================================== */

    const embed =
      new EmbedBuilder()
        .setTitle(
          '🛒 Boutique OMNIX'
        )
        .setDescription(
          'Bienvenue dans la boutique du serveur.'
        )
        .addFields(
          {
            name:
              '💎 Produits disponibles',
            value:
              'La boutique est prête à accueillir les produits configurés par les administrateurs.',
          },
          {
            name:
              '🏪 Serveur',
            value:
              interaction.guild?.name ??
              'Serveur Discord',
            inline: true,
          },
          {
            name:
              '💰 Économie',
            value:
              '🟢 Activée',
            inline: true,
          }
        )
        .setTimestamp();

    await interaction.reply({
      embeds: [
        embed,
      ],
    });
  },
};