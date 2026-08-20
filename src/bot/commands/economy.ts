import {
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

import {
  getGuildConfig,
} from '../utils/guildConfig.ts';

export default {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription(
      'Affiche le statut du système économique OMNIX.'
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

    /* =====================================================
       MODULE
    ===================================================== */

    const economy =
      config.modules?.economy;

    const enabled =
      Boolean(
        economy?.enabled
      );

    /* =====================================================
       EMBED
    ===================================================== */

    const embed =
      new EmbedBuilder()
        .setTitle(
          '💰 Économie OMNIX'
        )
        .setDescription(
          enabled
            ? 'Le système économique est actuellement **activé** sur ce serveur.'
            : 'Le système économique est actuellement **désactivé** sur ce serveur.'
        )
        .addFields({
          name: 'Statut',
          value: enabled
            ? '🟢 Activé'
            : '🔴 Désactivé',
          inline: true,
        })
        .addFields({
          name: 'Serveur',
          value:
            interaction.guild?.name ??
            'Serveur Discord',
          inline: true,
        })
        .setTimestamp();

    await interaction.reply({
      embeds: [
        embed,
      ],
    });
  },
};