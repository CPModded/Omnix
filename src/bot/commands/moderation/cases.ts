import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

import ModerationCase from '../../../models/ModerationCase';

const emoji: Record<string, string> = {
  warn: '⚠️',
  mute: '🔇',
  timeout: '⏳',
  kick: '👢',
  ban: '🔨',
  unban: '🔓',
  unmute: '🔊',
  unwarn: '↩️',
  softban: '🧹',
};

export default {
  data: new SlashCommandBuilder()
    .setName('cases')
    .setDescription('Affiche les dernières cases du serveur')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    )
    .addIntegerOption(option =>
      option
        .setName('nombre')
        .setDescription('Nombre de cases à afficher')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    const amount =
      interaction.options.getInteger('nombre') ?? 10;

    const cases = await ModerationCase.find({
      guildId: guild.id,
    })
      .sort({ caseNumber: -1 })
      .limit(amount)
      .lean();

    if (!cases.length) {
      return interaction.reply({
        content:
          '📭 Aucune case de modération enregistrée.',
        ephemeral: true,
      });
    }

    const description = cases
      .map(item => {
        const icon = emoji[item.action] ?? '🛡️';

        return (
          `${icon} **#${item.caseNumber} — ${item.action.toUpperCase()}**\n` +
          `👤 <@${item.userId}> • 👮 <@${item.moderatorId}>\n` +
          `📝 ${item.reason}`
        );
      })
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📋 Cases de ${guild.name}`)
      .setDescription(description)
      .setFooter({
        text: `${cases.length} case(s) affichée(s)`,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};