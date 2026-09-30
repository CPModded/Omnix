import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('emoji-list')
    .setDescription('Affiche les emojis du serveur'),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    const emojis = [...guild.emojis.cache.values()];

    const animated = emojis.filter(
      emoji => emoji.animated
    ).length;

    const normal = emojis.length - animated;

    const list = emojis
      .slice(0, 40)
      .map(
        emoji =>
          `${emoji} — \`${emoji.name}\``
      )
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`😀 Emojis — ${guild.name}`)
      .setDescription(
        list || 'Aucun emoji personnalisé.'
      )
      .addFields(
        {
          name: '📊 Total',
          value: `${emojis.length}`,
          inline: true,
        },
        {
          name: '🖼️ Statiques',
          value: `${normal}`,
          inline: true,
        },
        {
          name: '🎞️ Animés',
          value: `${animated}`,
          inline: true,
        }
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};