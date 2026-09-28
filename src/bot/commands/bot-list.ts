import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bot-list')
    .setDescription('Affiche les bots présents sur le serveur'),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    await guild.members.fetch();

    const bots = guild.members.cache
      .filter(member => member.user.bot)
      .sort((a, b) =>
        a.user.username.localeCompare(b.user.username)
      );

    const list = bots
      .map(
        (member, index) =>
          `**${index + 1}.** ${member} — \`${member.user.tag}\``
      )
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🤖 Bots du serveur')
      .setDescription(list || 'Aucun bot trouvé.')
      .addFields({
        name: '📊 Total',
        value: `${bots.size}`,
        inline: true,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};