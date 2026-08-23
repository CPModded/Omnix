import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprime plusieurs messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option =>
      option
        .setName('nombre')
        .setDescription('Nombre de messages à supprimer')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ Cette commande doit être utilisée sur un serveur.',
        ephemeral: true,
      });
    }

    if (!interaction.channel?.isTextBased()) {
      return interaction.reply({
        content: '❌ Cette commande doit être utilisée dans un salon textuel.',
        ephemeral: true,
      });
    }

    if (!('bulkDelete' in interaction.channel)) {
      return interaction.reply({
        content: '❌ Ce salon ne permet pas la suppression groupée.',
        ephemeral: true,
      });
    }

    const amount = interaction.options.getInteger('nombre', true);

    const deleted = await interaction.channel
      .bulkDelete(amount, true)
      .catch(() => null);

    if (!deleted) {
      return interaction.reply({
        content:
          '❌ Impossible de supprimer les messages. Vérifie les permissions d’OMNIX.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🧹 Messages supprimés')
      .setDescription(
        `**${deleted.size}** message(s) ont été supprimé(s).`
      )
      .addFields({
        name: '🛡️ Modérateur',
        value: interaction.user.tag,
        inline: true,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};