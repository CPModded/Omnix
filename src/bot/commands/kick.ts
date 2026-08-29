import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulse un membre du serveur')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers
    )
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre à expulser')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('raison')
        .setDescription('Raison de l’expulsion')
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

    const reason =
      interaction.options.getString('raison') ??
      'Aucune raison fournie';

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

    if (!executor.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({
        content:
          '❌ Tu n’as pas la permission **Expulser des membres**.',
        ephemeral: true,
      });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ Tu ne peux pas t’expulser toi-même.',
        ephemeral: true,
      });
    }

    if (target.id === interaction.client.user.id) {
      return interaction.reply({
        content: '❌ Je ne peux pas m’expulser moi-même.',
        ephemeral: true,
      });
    }

    if (
      member.roles.highest.position >=
      executor.roles.highest.position
    ) {
      return interaction.reply({
        content:
          '❌ Tu ne peux pas expulser un membre ayant un rôle égal ou supérieur au tien.',
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
          '❌ Le rôle d’OMNIX est trop bas pour expulser ce membre.',
        ephemeral: true,
      });
    }

    // L'expulsion peut prendre plus de 3 secondes sur Discord.
    // On accuse donc réception juste avant l'opération réseau
    // afin d'éviter les erreurs 10062 (Unknown interaction).
    await interaction.deferReply();

    await member.kick(
      `${reason} | Par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('👢 Membre expulsé')
      .addFields(
        {
          name: '👤 Membre',
          value: `${target.tag}\n\`${target.id}\``,
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
          inline: false,
        }
      )
      .setThumbnail(
        target.displayAvatarURL({ size: 512 })
      )
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
    });
  },
};