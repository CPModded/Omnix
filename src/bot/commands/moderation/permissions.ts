import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

const permissions = [
  ['Administrator', '👑 Administrateur'],
  ['ManageGuild', '⚙️ Gérer le serveur'],
  ['ManageChannels', '📺 Gérer les salons'],
  ['ManageRoles', '🎭 Gérer les rôles'],
  ['ManageMessages', '🧹 Gérer les messages'],
  ['BanMembers', '🔨 Bannir'],
  ['KickMembers', '👢 Expulser'],
  ['ModerateMembers', '🔇 Modérer'],
  ['ManageWebhooks', '🔗 Gérer les webhooks'],
  ['ManageNicknames', '✏️ Gérer les pseudos'],
  ['ManageThreads', '🧵 Gérer les fils'],
  ['MentionEveryone', '📢 Mentionner everyone'],
  ['ViewAuditLog', '📋 Voir les logs'],
];

export default {
  data: new SlashCommandBuilder()
    .setName('permissions')
    .setDescription('Affiche les permissions d’un membre')
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre à analyser')
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

    const user =
      interaction.options.getUser('membre') ??
      interaction.user;

    const member = await guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      return interaction.reply({
        content: '❌ Membre introuvable.',
        ephemeral: true,
      });
    }

    const description = permissions
      .map(([key, label]) => {
        const permission =
          key as keyof typeof PermissionFlagsBits;

        const hasPermission =
          member.permissions.has(
            PermissionFlagsBits[permission]
          );

        return `${hasPermission ? '✅' : '❌'} ${label}`;
      })
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🔐 Permissions de ${user.tag}`)
      .setThumbnail(
        user.displayAvatarURL({
          size: 512,
        })
      )
      .setDescription(description)
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};