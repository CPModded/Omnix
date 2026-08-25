import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Affiche l’avatar d’un utilisateur')
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

    const avatar = user.displayAvatarURL({
      size: 4096,
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🖼️ Avatar de ${user.tag}`)
      .setImage(avatar)
      .setURL(avatar)
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};