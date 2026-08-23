import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('category-delete')
    .setDescription('Supprime une catégorie')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option =>
      option
        .setName('categorie')
        .setDescription('Catégorie à supprimer')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName('confirmation')
        .setDescription('Confirme la suppression')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const category = interaction.options.getChannel(
      'categorie',
      true
    );

    const confirmation = interaction.options.getBoolean(
      'confirmation',
      true
    );

    if (!confirmation) {
      return interaction.reply({
        content: '❌ Suppression annulée.',
        ephemeral: true,
      });
    }

    const name = category.name;

    await category.delete(
      `Catégorie supprimée par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🗑️ Catégorie supprimée')
      .setDescription(
        `La catégorie **${name}** a été supprimée.`
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};