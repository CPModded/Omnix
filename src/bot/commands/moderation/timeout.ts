import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Met un membre en timeout')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre à mettre en timeout')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('duree')
        .setDescription('Durée en minutes')
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('raison')
        .setDescription('Raison du timeout')
        .setMaxLength(500)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ Cette commande doit être utilisée sur un serveur.',
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser('membre', true);
    const duration = interaction.options.getInteger('duree', true);
    const reason =
      interaction.options.getString('raison') ??
      'Aucune raison fournie';

    const member = await interaction.guild.members
      .fetch(target.id)
      .catch(() => null);

    const executor = await interaction.guild.members
      .fetch(interaction.user.id);

    if (!member) {
      return interaction.reply({
        content: '❌ Membre introuvable sur ce serveur.',
        ephemeral: true,
      });
    }

    if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({
        content: '❌ Tu n’as pas la permission de gérer les timeouts.',
        ephemeral: true,
      });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ Tu ne peux pas te mettre toi-même en timeout.',
        ephemeral: true,
      });
    }

    if (
      member.roles.highest.position >=
      executor.roles.highest.position
    ) {
      return interaction.reply({
        content:
          '❌ Tu ne peux pas timeout un membre ayant un rôle égal ou supérieur au tien.',
        ephemeral: true,
      });
    }

    const botMember = interaction.guild.members.me;

    if (
      !botMember ||
      member.roles.highest.position >=
        botMember.roles.highest.position
    ) {
      return interaction.reply({
        content:
          '❌ Le rôle d’OMNIX est trop bas pour gérer ce membre.',
        ephemeral: true,
      });
    }

    await member.timeout(
      duration * 60 * 1000,
      `${reason} | Par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('⏱️ Timeout appliqué')
      .addFields(
        {
          name: '👤 Membre',
          value: `${target.tag}\n\`${target.id}\``,
          inline: true,
        },
        {
          name: '⏳ Durée',
          value: `${duration} minute(s)`,
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
        }
      )
      .setThumbnail(target.displayAvatarURL({ size: 512 }))
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};