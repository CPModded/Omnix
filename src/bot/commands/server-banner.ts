import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('server-banner')
    .setDescription('Affiche la bannière du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    const banner = guild.bannerURL({
      size: 4096,
      extension: 'png',
    });

    if (!banner) {
      return interaction.reply({
        content:
          '❌ Ce serveur ne possède pas de bannière.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🖼️ Bannière de ${guild.name}`)
      .setImage(banner)
      .setURL(banner)
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};