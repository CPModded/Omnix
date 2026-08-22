import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

import ModerationCase from '../../../models/ModerationCase.ts';

export default {
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Retire un avertissement')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    )
    .addIntegerOption(option =>
      option
        .setName('case')
        .setDescription('Numéro de la case')
        .setMinValue(1)
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

    const caseNumber = interaction.options.getInteger(
      'case',
      true
    );

    const warning = await ModerationCase.findOne({
      guildId: guild.id,
      caseNumber,
      action: 'warn',
    });

    if (!warning) {
      return interaction.reply({
        content: `❌ La Case #${caseNumber} n'existe pas.`,
        ephemeral: true,
      });
    }

    if (!warning.active) {
      return interaction.reply({
        content: `⚠️ La Case #${caseNumber} est déjà inactive.`,
        ephemeral: true,
      });
    }

    warning.active = false;
    await warning.save();

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('↩️ Avertissement retiré')
      .setDescription(
        `L'avertissement **Case #${caseNumber}** a été retiré.`
      )
      .addFields(
        {
          name: '👤 Membre',
          value: `<@${warning.userId}>`,
          inline: true,
        },
        {
          name: '👮 Modérateur',
          value: `<@${interaction.user.id}>`,
          inline: true,
        }
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};