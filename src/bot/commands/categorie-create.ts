import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('category-create')
    .setDescription('Crée une catégorie')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(option =>
      option
        .setName('nom')
        .setDescription('Nom de la catégorie')
        .setMaxLength(100)
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

    const name = interaction.options.getString('nom', true);

    const category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      reason: `Créée par ${interaction.user.tag}`,
    });

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('📁 Catégorie créée')
      .setDescription(
        `La catégorie **${category.name}** a été créée.`
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};