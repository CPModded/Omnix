import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannit un membre du serveur')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.BanMembers
    )
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre à bannir')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('raison')
        .setDescription('Raison du bannissement')
        .setMaxLength(500)
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('messages')
        .setDescription('Jours de messages à supprimer (0 à 15)')
        .setMinValue(0)
        .setMaxValue(15)
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
    const reason =
      interaction.options.getString('raison') ??
      'Aucune raison fournie';

    const deleteMessageDays =
      interaction.options.getInteger('messages') ?? 0;

    const member = await interaction.guild.members
      .fetch(target.id)
      .catch(() => null);

    if (!member) {
      return interaction.reply({
        content: '❌ Ce membre n’est pas présent sur le serveur.',
        ephemeral: true,
      });
    }

    const executor = await interaction.guild.members
      .fetch(interaction.user.id);

    if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content:
          '❌ Tu n’as pas la permission **Bannir des membres**.',
        ephemeral: true,
      });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ Tu ne peux pas te bannir toi-même.',
        ephemeral: true,
      });
    }

    if (target.id === interaction.client.user.id) {
      return interaction.reply({
        content: '❌ Je ne peux pas me bannir moi-même.',
        ephemeral: true,
      });
    }

    if (
      member.roles.highest.position >=
      executor.roles.highest.position
    ) {
      return interaction.reply({
        content:
          '❌ Tu ne peux pas bannir un membre ayant un rôle égal ou supérieur au tien.',
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
          '❌ Le rôle d’OMNIX est trop bas pour bannir ce membre.',
        ephemeral: true,
      });
    }

    await member.ban({
      deleteMessageSeconds: deleteMessageDays * 24 * 60 * 60,
      reason: `${reason} | Par ${interaction.user.tag}`,
    });

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🔨 Membre banni')
      .addFields(
        {
          name: '👤 Membre',
          value: `${target.tag}\n\`${target.id}\``,
          inline: true,
        },
        {
          name: '🛡️ Modérateur',
          value: `${interaction.user.tag}`,
          inline: true,
        },
        {
          name: '📝 Raison',
          value: reason,
          inline: false,
        },
        {
          name: '🗑️ Messages supprimés',
          value: `${deleteMessageDays} jour(s)`,
          inline: true,
        }
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