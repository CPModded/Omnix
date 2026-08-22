import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

import ModerationCase from '../../../models/ModerationCase.ts';

export default {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Affiche les avertissements d’un membre')
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre à consulter')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content:
          '❌ Cette commande doit être utilisée sur un serveur.',
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser(
      'membre',
      true
    );

    const warnings = await ModerationCase.find({
      guildId: guild.id,
      userId: user.id,
      action: 'warn',
      active: true,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    if (!warnings.length) {
      return interaction.reply({
        content: `✅ **${user.tag}** n’a aucun avertissement actif sur ce serveur.`,
        ephemeral: true,
      });
    }

    const description = warnings
      .map((warning, index) => {
        const timestamp = Math.floor(
          new Date(warning.createdAt).getTime() / 1000
        );

        return [
          `### ⚠️ Case #${warning.caseNumber}`,
          `📝 **Raison :** ${warning.reason}`,
          `👮 **Modérateur :** <@${warning.moderatorId}>`,
          `📅 <t:${timestamp}:R>`,
        ].join('\n');
      })
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle(`⚠️ Avertissements de ${user.tag}`)
      .setThumbnail(
        user.displayAvatarURL({
          size: 512,
        })
      )
      .setDescription(description)
      .addFields({
        name: '📊 Avertissements actifs',
        value: `${warnings.length}`,
        inline: true,
      })
      .setFooter({
        text: guild.name,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};