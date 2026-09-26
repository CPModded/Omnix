import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('role-permissions')
    .setDescription('Affiche les permissions principales d’un rôle')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Rôle à consulter')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const role = interaction.options.getRole(
      'role',
      true
    );

    const permissions = role.permissions;

    const importantPermissions = [
      [
        'Administrator',
        '👑 Administrateur',
        permissions.has(PermissionFlagsBits.Administrator),
      ],
      [
        'ManageGuild',
        '⚙️ Gérer le serveur',
        permissions.has(PermissionFlagsBits.ManageGuild),
      ],
      [
        'ManageChannels',
        '📺 Gérer les salons',
        permissions.has(PermissionFlagsBits.ManageChannels),
      ],
      [
        'ManageRoles',
        '🎭 Gérer les rôles',
        permissions.has(PermissionFlagsBits.ManageRoles),
      ],
      [
        'ManageMessages',
        '🧹 Gérer les messages',
        permissions.has(PermissionFlagsBits.ManageMessages),
      ],
      [
        'BanMembers',
        '🔨 Bannir',
        permissions.has(PermissionFlagsBits.BanMembers),
      ],
      [
        'KickMembers',
        '👢 Expulser',
        permissions.has(PermissionFlagsBits.KickMembers),
      ],
      [
        'ModerateMembers',
        '🔇 Modérer',
        permissions.has(PermissionFlagsBits.ModerateMembers),
      ],
    ];

    const description = importantPermissions
      .map(([, name, enabled]) =>
        `${enabled ? '✅' : '❌'} ${name}`
      )
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(role.color || 0x5865f2)
      .setTitle(`🎭 Permissions de ${role.name}`)
      .setDescription(description)
      .setFooter({
        text: `ID : ${role.id}`,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};