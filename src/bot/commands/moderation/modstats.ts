import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

import ModerationCase from '../../../models/ModerationCase';

export default {
  data: new SlashCommandBuilder()
    .setName('modstats')
    .setDescription('Affiche les statistiques de modération')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    const cases = await ModerationCase.find({
      guildId: guild.id,
    })
      .select('action active')
      .lean();

    const count = (action: string) =>
      cases.filter(item => item.action === action).length;

    const activeWarnings = cases.filter(
      item =>
        item.action === 'warn' &&
        item.active
    ).length;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 Modération — ${guild.name}`)
      .addFields(
        {
          name: '📋 Total des cases',
          value: `${cases.length}`,
          inline: true,
        },
        {
          name: '⚠️ Warnings',
          value: `${count('warn')}`,
          inline: true,
        },
        {
          name: '🟢 Warnings actifs',
          value: `${activeWarnings}`,
          inline: true,
        },
        {
          name: '👢 Kicks',
          value: `${count('kick')}`,
          inline: true,
        },
        {
          name: '🔨 Bans',
          value: `${count('ban')}`,
          inline: true,
        },
        {
          name: '⏳ Timeouts',
          value: `${count('timeout')}`,
          inline: true,
        },
        {
          name: '🔇 Mutes',
          value: `${count('mute')}`,
          inline: true,
        },
        {
          name: '🧹 Softbans',
          value: `${count('softban')}`,
          inline: true,
        }
      )
      .setFooter({
        text: `Statistiques propres à ${guild.name}`,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};