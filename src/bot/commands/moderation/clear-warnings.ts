import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

import ModerationCase from '../../../models/ModerationCase';

export default {
  data: new SlashCommandBuilder()
    .setName('clear-warnings')
    .setDescription('Retire tous les avertissements actifs')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    )
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre concerné')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser(
      'membre',
      true
    );

    const result = await ModerationCase.updateMany(
      {
        guildId: guild.id,
        userId: user.id,
        action: 'warn',
        active: true,
      },
      {
        $set: {
          active: false,
        },
      }
    );

    if (result.modifiedCount === 0) {
      return interaction.reply({
        content: `ℹ️ **${user.tag}** n'a aucun avertissement actif.`,
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🧹 Avertissements supprimés')
      .setDescription(
        `Les avertissements actifs de ${user} ont été retirés.`
      )
      .addFields({
        name: '📊 Nombre retiré',
        value: `${result.modifiedCount}`,
        inline: true,
      })
      .setFooter({
        text: `Action effectuée par ${interaction.user.tag}`,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};