import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('server-icon')
    .setDescription('Affiche l’icône du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    const icon = guild.iconURL({
      size: 4096,
      extension: 'png',
    });

    if (!icon) {
      return interaction.reply({
        content:
          '❌ Ce serveur ne possède pas d’icône.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🖼️ Icône de ${guild.name}`)
      .setImage(icon)
      .setURL(icon)
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};