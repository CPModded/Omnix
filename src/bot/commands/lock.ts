import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Verrouille le salon actuel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.channel;

    if (!interaction.guild || !channel || !('permissionOverwrites' in channel)) {
      return interaction.reply({
        content: '❌ Ce salon ne peut pas être verrouillé.',
        ephemeral: true,
      });
    }

    const everyoneRole = interaction.guild.roles.everyone;

    await channel.permissionOverwrites.edit(
      everyoneRole,
      {
        SendMessages: false,
      }
    );

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🔒 Salon verrouillé')
      .setDescription(
        `Le salon ${channel} vient d’être verrouillé.`
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