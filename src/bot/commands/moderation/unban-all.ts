import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unban-all')
    .setDescription('Débannit tous les utilisateurs bannis du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addBooleanOption(option =>
      option
        .setName('confirmation')
        .setDescription('Confirme le débannissement global')
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

    const confirmation =
      interaction.options.getBoolean(
        'confirmation',
        true
      );

    if (!confirmation) {
      return interaction.reply({
        content:
          '❌ Opération annulée. Tu dois utiliser `confirmation:true`.',
        ephemeral: true,
      });
    }

    const member = await guild.members.fetch(
      interaction.user.id
    );

    if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content:
          '❌ Tu n’as pas la permission de gérer les bannissements.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({
      ephemeral: true,
    });

    const bans = await guild.bans.fetch().catch(() => null);

    if (!bans) {
      return interaction.editReply(
        '❌ Impossible de récupérer la liste des bannissements.'
      );
    }

    if (bans.size === 0) {
      return interaction.editReply(
        'ℹ️ Aucun utilisateur n’est actuellement banni.'
      );
    }

    let success = 0;
    let failed = 0;

    for (const ban of bans.values()) {
      try {
        await guild.members.unban(
          ban.user.id,
          `Débannissement global par ${interaction.user.tag}`
        );

        success++;
      } catch {
        failed++;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(failed === 0 ? 0x57f287 : 0xffa500)
      .setTitle('🔓 Débannissement global terminé')
      .setDescription(
        `OMNIX a terminé l’opération sur **${bans.size}** bannissement(s).`
      )
      .addFields(
        {
          name: '✅ Débannis',
          value: `**${success}**`,
          inline: true,
        },
        {
          name: '❌ Échecs',
          value: `**${failed}**`,
          inline: true,
        }
      )
      .setFooter({
        text: `OMNIX • ${guild.name}`,
      })
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
    });
  },
};