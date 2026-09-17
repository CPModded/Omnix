import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription('Affiche la bannière d’un utilisateur')
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Utilisateur ciblé')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const user =
      interaction.options.getUser('membre') ??
      interaction.user;

    const fetchedUser = await user.fetch();

    const banner = fetchedUser.bannerURL({
      size: 4096,
    });

    if (!banner) {
      return interaction.reply({
        content:
          '❌ Cet utilisateur ne possède pas de bannière.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🖼️ Bannière de ${user.tag}`)
      .setImage(banner)
      .setURL(banner)
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};