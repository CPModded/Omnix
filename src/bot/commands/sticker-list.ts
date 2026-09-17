import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sticker-list')
    .setDescription('Affiche les stickers du serveur'),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    const stickers = [...guild.stickers.cache.values()];

    const list = stickers
      .map(
        sticker =>
          `**${sticker.name}** — \`${sticker.id}\``
      )
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🏷️ Stickers — ${guild.name}`)
      .setDescription(
        list || 'Aucun sticker personnalisé.'
      )
      .addFields({
        name: '📊 Total',
        value: `${stickers.length}`,
        inline: true,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};