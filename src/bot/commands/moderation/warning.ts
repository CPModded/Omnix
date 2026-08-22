import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

import ModerationCase from '../../../models/ModerationCase.ts';

export default {
  data: new SlashCommandBuilder()
    .setName('warning')
    .setDescription('Consulte un avertissement précis')
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
        content: '❌ Cette commande doit être utilisée sur un serveur.',
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
    }).lean();

    if (!warning) {
      return interaction.reply({
        content: `❌ Aucun avertissement correspondant à la **Case #${caseNumber}**.`,
        ephemeral: true,
      });
    }

    const timestamp = Math.floor(
      new Date(warning.createdAt).getTime() / 1000
    );

    const embed = new EmbedBuilder()
      .setColor(warning.active ? 0xffa500 : 0x808080)
      .setTitle(`⚠️ Avertissement — Case #${warning.caseNumber}`)
      .addFields(
        {
          name: '👤 Membre',
          value: `<@${warning.userId}>`,
          inline: true,
        },
        {
          name: '👮 Modérateur',
          value: `<@${warning.moderatorId}>`,
          inline: true,
        },
        {
          name: '📌 Statut',
          value: warning.active ? '🟢 Actif' : '⚪ Retiré',
          inline: true,
        },
        {
          name: '📝 Raison',
          value: warning.reason,
          inline: false,
        },
        {
          name: '📅 Date',
          value: `<t:${timestamp}:F>`,
          inline: false,
        }
      )
      .setFooter({
        text: guild.name,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};