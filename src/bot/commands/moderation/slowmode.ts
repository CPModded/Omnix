import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Configure le mode lent du salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(option =>
      option
        .setName('secondes')
        .setDescription('Durée entre deux messages')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.channel;

    if (!interaction.guild || !channel || !('setRateLimitPerUser' in channel)) {
      return interaction.reply({
        content:
          '❌ Le mode lent n’est pas disponible dans ce salon.',
        ephemeral: true,
      });
    }

    const seconds = interaction.options.getInteger(
      'secondes',
      true
    );

    await channel.setRateLimitPerUser(
      seconds,
      `Mode lent configuré par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🐌 Mode lent configuré')
      .setDescription(
        seconds === 0
          ? 'Le mode lent a été **désactivé**.'
          : `Le mode lent est maintenant de **${seconds} seconde(s)**.`
      )
      .addFields({
        name: '🛡️ Responsable',
        value: interaction.user.tag,
        inline: true,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};