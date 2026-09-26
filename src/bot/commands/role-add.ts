import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('role-add')
    .setDescription('Ajoute un rôle à un membre')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageRoles
    )
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre ciblé')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Rôle à ajouter')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    const target = interaction.options.getMember('membre');
    const role = interaction.options.getRole('role', true);

    if (!target || !('roles' in target)) {
      return interaction.reply({
        content: '❌ Membre introuvable.',
        ephemeral: true,
      });
    }

    const executor = await guild.members.fetch(
      interaction.user.id
    );

    const bot = guild.members.me;

    if (!bot) {
      return interaction.reply({
        content: '❌ Impossible de récupérer OMNIX.',
        ephemeral: true,
      });
    }

    if (role.managed) {
      return interaction.reply({
        content:
          '❌ Ce rôle est géré par une intégration et ne peut pas être attribué.',
        ephemeral: true,
      });
    }

    if (
      role.position >= executor.roles.highest.position &&
      executor.id !== guild.ownerId
    ) {
      return interaction.reply({
        content:
          '❌ Tu ne peux pas attribuer un rôle égal ou supérieur au tien.',
        ephemeral: true,
      });
    }

    if (role.position >= bot.roles.highest.position) {
      return interaction.reply({
        content:
          '❌ Le rôle d’OMNIX est trop bas pour attribuer ce rôle.',
        ephemeral: true,
      });
    }

    await target.roles.add(
      role,
      `Rôle ajouté par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🎭 Rôle ajouté')
      .setDescription(
        `${target} reçoit maintenant le rôle ${role}.`
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};