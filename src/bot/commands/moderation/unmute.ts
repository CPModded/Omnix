import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Retire le timeout d’un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre à débloquer')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('raison')
        .setDescription('Raison')
        .setMaxLength(500)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Cette commande doit être utilisée sur un serveur.',
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser(
      'membre',
      true
    );

    const reason =
      interaction.options.getString('raison') ??
      'Aucune raison fournie';

    const member = await guild.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (!member) {
      return interaction.reply({
        content: '❌ Ce membre n’est pas présent sur le serveur.',
        ephemeral: true,
      });
    }

    const executor = await guild.members.fetch(
      interaction.user.id
    );

    if (
      member.roles.highest.position >=
        executor.roles.highest.position &&
      executor.id !== guild.ownerId
    ) {
      return interaction.reply({
        content:
          '❌ Tu ne peux pas retirer le timeout d’un membre ayant un rôle égal ou supérieur au tien.',
        ephemeral: true,
      });
    }

    if (!member.communicationDisabledUntilTimestamp) {
      return interaction.reply({
        content: '❌ Ce membre n’est actuellement pas en timeout.',
        ephemeral: true,
      });
    }

    await member.timeout(
      null,
      `${reason} | Par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🔊 Timeout retiré')
      .setDescription(
        `${member} peut maintenant communiquer normalement.`
      )
      .addFields(
        {
          name: '👤 Membre',
          value: `${targetUser.tag}\n\`${targetUser.id}\``,
          inline: true,
        },
        {
          name: '🛡️ Modérateur',
          value: interaction.user.tag,
          inline: true,
        },
        {
          name: '📝 Raison',
          value: reason,
        },
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};