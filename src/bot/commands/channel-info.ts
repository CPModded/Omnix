import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('channel-info')
    .setDescription('Affiche les informations d’un salon')
    .addChannelOption(option =>
      option
        .setName('salon')
        .setDescription('Salon à consulter')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel =
      interaction.options.getChannel('salon') ??
      interaction.channel;

    if (!channel) {
      return interaction.reply({
        content: '❌ Salon introuvable.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📺 ${channel.name}`)
      .addFields(
        {
          name: '🆔 ID',
          value: `\`${channel.id}\``,
          inline: true,
        },
        {
          name: '📂 Type',
          value: channel.type.toString(),
          inline: true,
        },
        {
          name: '📁 Catégorie',
          value:
            'parent' in channel && channel.parent
              ? channel.parent.name
              : 'Aucune',
          inline: true,
        },
        {
          name: '📅 Création',
          value: `<t:${Math.floor(
            channel.createdTimestamp / 1000
          )}:F>`,
          inline: false,
        }
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};