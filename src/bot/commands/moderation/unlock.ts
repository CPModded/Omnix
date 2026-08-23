import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Déverrouille le salon actuel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.channel;

    if (!interaction.guild || !channel || !('permissionOverwrites' in channel)) {
      return interaction.reply({
        content: '❌ Ce salon ne peut pas être déverrouillé.',
        ephemeral: true,
      });
    }

    const everyoneRole = interaction.guild.roles.everyone;

    await channel.permissionOverwrites.edit(
      everyoneRole,
      {
        SendMessages: null,
      }
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🔓 Salon déverrouillé')
      .setDescription(
        `Le salon ${channel} est de nouveau accessible.`
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