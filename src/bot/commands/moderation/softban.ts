import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Bannit puis débannit un membre pour supprimer ses messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre ciblé')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('jours')
        .setDescription('Jours de messages à supprimer')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('raison')
        .setDescription('Raison du softban')
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

    const target = interaction.options.getUser(
      'membre',
      true
    );

    const days =
      interaction.options.getInteger('jours') ?? 1;

    const reason =
      interaction.options.getString('raison') ??
      'Aucune raison fournie';

    const member = await guild.members
      .fetch(target.id)
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

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ Tu ne peux pas te softban toi-même.',
        ephemeral: true,
      });
    }

    if (
      member.roles.highest.position >=
        executor.roles.highest.position &&
      executor.id !== guild.ownerId
    ) {
      return interaction.reply({
        content:
          '❌ Tu ne peux pas softban un membre ayant un rôle égal ou supérieur au tien.',
        ephemeral: true,
      });
    }

    const botMember = guild.members.me;

    if (
      !botMember ||
      member.roles.highest.position >=
        botMember.roles.highest.position
    ) {
      return interaction.reply({
        content:
          '❌ Le rôle d’OMNIX est trop bas pour effectuer cette action.',
        ephemeral: true,
      });
    }

    await member.ban({
      deleteMessageSeconds: days * 24 * 60 * 60,
      reason: `${reason} | Softban par ${interaction.user.tag}`,
    });

    await guild.members.unban(
      target.id,
      `Softban terminé | ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('🧹 Softban effectué')
      .setDescription(
        `${target} a été temporairement banni puis débanni afin de supprimer ses messages récents.`
      )
      .addFields(
        {
          name: '👤 Membre',
          value: `${target.tag}\n\`${target.id}\``,
          inline: true,
        },
        {
          name: '🗑️ Messages',
          value: `${days} jour(s)`,
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
      .setThumbnail(
        target.displayAvatarURL({ size: 512 })
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};