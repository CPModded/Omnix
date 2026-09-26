import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('role-delete')
    .setDescription('Supprime un rôle')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Rôle à supprimer')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName('confirmation')
        .setDescription('Confirme la suppression du rôle')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    const role = interaction.options.getRole('role', true);
    const confirmation =
      interaction.options.getBoolean('confirmation', true);

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    if (!confirmation) {
      return interaction.reply({
        content: '❌ Suppression annulée.',
        ephemeral: true,
      });
    }

    if (role.managed) {
      return interaction.reply({
        content:
          '❌ Ce rôle est géré par une intégration et ne peut pas être supprimé.',
        ephemeral: true,
      });
    }

    const executor = await guild.members.fetch(
      interaction.user.id
    );

    const botMember = guild.members.me;

    if (
      executor.id !== guild.ownerId &&
      role.position >= executor.roles.highest.position
    ) {
      return interaction.reply({
        content:
          '❌ Tu ne peux pas supprimer un rôle égal ou supérieur au tien.',
        ephemeral: true,
      });
    }

    if (
      botMember &&
      role.position >= botMember.roles.highest.position
    ) {
      return interaction.reply({
        content:
          '❌ Le rôle d’OMNIX est trop bas pour supprimer ce rôle.',
        ephemeral: true,
      });
    }

    const roleName = role.name;

    await role.delete(
      `Supprimé par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🗑️ Rôle supprimé')
      .setDescription(
        `Le rôle **${roleName}** a été supprimé.`
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};