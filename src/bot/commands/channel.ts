import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Affiche les informations détaillées d’un salon')
    .addChannelOption(option =>
      option
        .setName('salon')
        .setDescription('Salon à consulter')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Cette commande doit être utilisée sur un serveur.',
        ephemeral: true,
      });
    }

    const channel =
      interaction.options.getChannel('salon') ??
      interaction.channel;

    if (!channel) {
      return interaction.reply({
        content: '❌ Impossible de récupérer ce salon.',
        ephemeral: true,
      });
    }

    const typeNames: Record<number, string> = {
      [ChannelType.GuildText]: '💬 Salon textuel',
      [ChannelType.GuildVoice]: '🔊 Salon vocal',
      [ChannelType.GuildCategory]: '📁 Catégorie',
      [ChannelType.GuildAnnouncement]: '📢 Salon d’annonces',
      [ChannelType.GuildStageVoice]: '🎙️ Salon Stage',
      [ChannelType.GuildForum]: '📰 Forum',
      [ChannelType.GuildMedia]: '🖼️ Salon média',
    };

    const position =
      'position' in channel
        ? channel.position
        : 'Inconnue';

    const parent =
      'parent' in channel && channel.parent
        ? `${channel.parent}`
        : 'Aucune';

    const createdTimestamp = Math.floor(
      channel.createdTimestamp / 1000
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📺 Informations — ${channel.name}`)
      .addFields(
        {
          name: '📌 Salon',
          value: `${channel}\n\`${channel.id}\``,
          inline: true,
        },
        {
          name: '📂 Type',
          value:
            typeNames[channel.type] ??
            `Type ${channel.type}`,
          inline: true,
        },
        {
          name: '📍 Position',
          value: `**${position}**`,
          inline: true,
        },
        {
          name: '📁 Catégorie',
          value: parent,
          inline: true,
        },
        {
          name: '📅 Création',
          value:
            `<t:${createdTimestamp}:F>\n` +
            `<t:${createdTimestamp}:R>`,
          inline: true,
        },
        {
          name: '🔗 Mention',
          value: `\`${channel.toString()}\``,
          inline: true,
        },
      )
      .setFooter({
        text: `OMNIX • ${guild.name}`,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};