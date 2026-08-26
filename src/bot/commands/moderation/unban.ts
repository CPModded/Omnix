import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Débannit un utilisateur')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(option =>
      option
        .setName('id')
        .setDescription('ID Discord de l’utilisateur')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('raison')
        .setDescription('Raison du débannissement')
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

    const userId = interaction.options.getString('id', true);
    const reason =
      interaction.options.getString('raison') ??
      'Aucune raison fournie';

    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({
        content: '❌ L’ID Discord fourni est invalide.',
        ephemeral: true,
      });
    }

    const ban = await guild.bans.fetch(userId).catch(() => null);

    if (!ban) {
      return interaction.reply({
        content: '❌ Cet utilisateur n’est pas banni.',
        ephemeral: true,
      });
    }

    await guild.members.unban(
      userId,
      `${reason} | Par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🔓 Utilisateur débanni')
      .addFields(
        {
          name: '👤 Utilisateur',
          value: `${ban.user.tag}\n\`${ban.user.id}\``,
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
        ban.user.displayAvatarURL({ size: 512 })
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};