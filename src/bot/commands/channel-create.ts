import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('channel-create')
    .setDescription('Crée un nouveau salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(option =>
      option
        .setName('nom')
        .setDescription('Nom du salon')
        .setMaxLength(100)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type de salon')
        .setRequired(false)
        .addChoices(
          { name: 'Texte', value: 'text' },
          { name: 'Vocal', value: 'voice' },
          { name: 'Annonce', value: 'announcement' },
          { name: 'Forum', value: 'forum' }
        )
    )
    .addChannelOption(option =>
      option
        .setName('categorie')
        .setDescription('Catégorie du salon')
        .addChannelTypes(ChannelType.GuildCategory)
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

    const name = interaction.options.getString('nom', true);
    const type = interaction.options.getString('type') ?? 'text';
    const category = interaction.options.getChannel('categorie');

    const types: Record<string, ChannelType> = {
      text: ChannelType.GuildText,
      voice: ChannelType.GuildVoice,
      announcement: ChannelType.GuildAnnouncement,
      forum: ChannelType.GuildForum,
    };

    const channel = await guild.channels.create({
      name,
      type: types[type],
      parent: category?.id,
      reason: `Créé par ${interaction.user.tag}`,
    });

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('📺 Salon créé')
      .setDescription(
        `${channel} a été créé avec succès.`
      )
      .addFields({
        name: '📂 Type',
        value: type,
        inline: true,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};