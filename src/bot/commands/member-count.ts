import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('member-count')
    .setDescription('Affiche les statistiques des membres'),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    await guild.members.fetch();

    const humans = guild.members.cache.filter(
      member => !member.user.bot
    ).size;

    const bots = guild.members.cache.filter(
      member => member.user.bot
    ).size;

    const online = guild.members.cache.filter(
      member =>
        member.presence?.status &&
        member.presence.status !== 'offline'
    ).size;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`👥 Membres — ${guild.name}`)
      .addFields(
        {
          name: '👤 Humains',
          value: `${humans}`,
          inline: true,
        },
        {
          name: '🤖 Bots',
          value: `${bots}`,
          inline: true,
        },
        {
          name: '🟢 En ligne',
          value: `${online}`,
          inline: true,
        },
        {
          name: '📊 Total',
          value: `${guild.memberCount}`,
          inline: true,
        }
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};