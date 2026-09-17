import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  User
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Affiche les informations détaillées d’un utilisateur')
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Utilisateur à consulter')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ Cette commande doit être utilisée sur un serveur.',
        ephemeral: true
      });
    }

    const target: User =
      interaction.options.getUser('membre') ?? interaction.user;

    const member = await interaction.guild.members
      .fetch(target.id)
      .catch(() => null);

    const createdTimestamp = Math.floor(
      target.createdTimestamp / 1000
    );

    const joinedTimestamp = member?.joinedTimestamp
      ? Math.floor(member.joinedTimestamp / 1000)
      : null;

    const roles = member
      ? member.roles.cache
          .filter(role => role.id !== interaction.guild!.id)
          .sort((a, b) => b.position - a.position)
          .map(role => role.toString())
          .slice(0, 15)
          .join(', ')
      : 'Non présent sur le serveur';

    const badges = target.flags?.toArray();

    const badgeText =
      badges && badges.length > 0
        ? badges.map(badge => `\`${badge}\``).join(', ')
        : 'Aucun badge';

    const status = member?.presence?.status ?? 'offline';

    const statusNames: Record<string, string> = {
      online: '🟢 En ligne',
      idle: '🌙 Inactif',
      dnd: '⛔ Ne pas déranger',
      offline: '⚫ Hors ligne'
    };

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`👤 Profil de ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 1024 }))
      .addFields(
        {
          name: '🏷️ Utilisateur',
          value:
            `Nom : **${target.username}**\n` +
            `Tag : **${target.tag}**\n` +
            `ID : \`${target.id}\``,
          inline: true
        },
        {
          name: '🤖 Compte',
          value: target.bot
            ? '🤖 Bot Discord'
            : '👤 Utilisateur',
          inline: true
        },
        {
          name: '📅 Compte créé',
          value:
            `<t:${createdTimestamp}:F>\n` +
            `<t:${createdTimestamp}:R>`,
          inline: true
        },
        {
          name: '📥 Arrivée sur le serveur',
          value: joinedTimestamp
            ? `<t:${joinedTimestamp}:F>\n<t:${joinedTimestamp}:R>`
            : 'Non disponible',
          inline: true
        },
        {
          name: '📡 Statut',
          value: statusNames[status] ?? '⚫ Hors ligne',
          inline: true
        },
        {
          name: '🎭 Rôles',
          value: roles || 'Aucun rôle',
          inline: false
        },
        {
          name: '🏅 Badges',
          value: badgeText,
          inline: false
        }
      )
      .setFooter({
        text: `OMNIX • ID ${target.id}`
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });
  }
};