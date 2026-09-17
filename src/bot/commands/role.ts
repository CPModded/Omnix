import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Affiche les informations détaillées d’un rôle')
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Rôle à consulter')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Cette commande doit être utilisée sur un serveur.',
        ephemeral: true,
      });
    }

    const role = interaction.options.getRole('role', true);

    const createdTimestamp = Math.floor(
      role.createdTimestamp / 1000
    );

    const membersWithRole = guild.members.cache.filter(
      member => member.roles.cache.has(role.id)
    ).size;

    const permissions = role.permissions.toArray();

    const permissionText =
      permissions.length > 0
        ? permissions
            .slice(0, 20)
            .map(permission => `\`${permission}\``)
            .join(', ')
        : 'Aucune';

    const embed = new EmbedBuilder()
      .setColor(role.color || 0x5865f2)
      .setTitle(`🎭 Informations — ${role.name}`)
      .addFields(
        {
          name: '🏷️ Nom',
          value: `**${role.name}**`,
          inline: true,
        },
        {
          name: '🆔 Identifiant',
          value: `\`${role.id}\``,
          inline: true,
        },
        {
          name: '📊 Position',
          value: `**${role.position}**`,
          inline: true,
        },
        {
          name: '👥 Membres',
          value: `**${membersWithRole}**`,
          inline: true,
        },
        {
          name: '🎨 Couleur',
          value: role.hexColor,
          inline: true,
        },
        {
          name: '🔗 Mention',
          value: role.toString(),
          inline: true,
        },
        {
          name: '⚙️ Permissions',
          value: permissionText,
          inline: false,
        },
        {
          name: '📅 Création',
          value:
            `<t:${createdTimestamp}:F>\n` +
            `<t:${createdTimestamp}:R>`,
          inline: true,
        },
        {
          name: '🔐 Particularités',
          value:
            `Mentionnable : **${role.mentionable ? 'Oui' : 'Non'}**\n` +
            `Géré par une intégration : **${role.managed ? 'Oui' : 'Non'}**\n` +
            `Administrateur : **${
              role.permissions.has('Administrator')
                ? 'Oui'
                : 'Non'
            }**`,
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