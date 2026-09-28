import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('channel-delete')
    .setDescription('Supprime un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option =>
      option
        .setName('salon')
        .setDescription('Salon à supprimer')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName('confirmation')
        .setDescription('Confirme la suppression')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel(
      'salon',
      true
    );

    const confirmation =
      interaction.options.getBoolean('confirmation', true);

    if (!confirmation) {
      return interaction.reply({
        content: '❌ Suppression annulée.',
        ephemeral: true,
      });
    }

    const name = channel.name;

    await channel.delete(
      `Supprimé par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🗑️ Salon supprimé')
      .setDescription(
        `Le salon **${name}** a été supprimé.`
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};