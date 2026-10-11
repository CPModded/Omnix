import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('channel-list')
    .setDescription('Affiche la liste des salons'),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    const text = guild.channels.cache.filter(
      channel =>
        channel.type === ChannelType.GuildText
    );

    const voice = guild.channels.cache.filter(
      channel =>
        channel.type === ChannelType.GuildVoice
    );

    const categories = guild.channels.cache.filter(
      channel =>
        channel.type === ChannelType.GuildCategory
    );

    const announcements = guild.channels.cache.filter(
      channel =>
        channel.type === ChannelType.GuildAnnouncement
    );

    const forums = guild.channels.cache.filter(
      channel =>
        channel.type === ChannelType.GuildForum
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📺 Salons — ${guild.name}`)
      .addFields(
        {
          name: '💬 Textuels',
          value: `${text.size}`,
          inline: true,
        },
        {
          name: '🔊 Vocaux',
          value: `${voice.size}`,
          inline: true,
        },
        {
          name: '📢 Annonces',
          value: `${announcements.size}`,
          inline: true,
        },
        {
          name: '🗂️ Catégories',
          value: `${categories.size}`,
          inline: true,
        },
        {
          name: '💭 Forums',
          value: `${forums.size}`,
          inline: true,
        }
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};