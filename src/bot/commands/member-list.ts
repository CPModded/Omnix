import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('member-list')
    .setDescription('Affiche la liste des membres du serveur')
    .addIntegerOption(option =>
      option
        .setName('page')
        .setDescription('Numéro de page')
        .setMinValue(1)
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

    await guild.members.fetch();

    const page = interaction.options.getInteger('page') ?? 1;
    const perPage = 15;

    const members = [...guild.members.cache.values()]
      .sort((a, b) =>
        a.user.username.localeCompare(b.user.username)
      );

    const totalPages = Math.max(
      1,
      Math.ceil(members.length / perPage)
    );

    if (page > totalPages) {
      return interaction.reply({
        content: `❌ Page invalide. Il y a **${totalPages}** page(s).`,
        ephemeral: true,
      });
    }

    const start = (page - 1) * perPage;

    const list = members
      .slice(start, start + perPage)
      .map(
        (member, index) =>
          `**${start + index + 1}.** ${member} — \`${member.user.tag}\``
      )
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`👥 Membres — ${guild.name}`)
      .setDescription(list || 'Aucun membre.')
      .setFooter({
        text: `Page ${page}/${totalPages} • ${members.length} membres`,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};