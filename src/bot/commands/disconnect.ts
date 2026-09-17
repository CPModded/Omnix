import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Déconnecte un membre d’un salon vocal')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre à déconnecter')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.options.getMember('membre');

    if (!member || !('voice' in member)) {
      return interaction.reply({
        content: '❌ Membre introuvable.',
        ephemeral: true,
      });
    }

    if (!member.voice.channel) {
      return interaction.reply({
        content: '❌ Ce membre n’est pas dans un salon vocal.',
        ephemeral: true,
      });
    }

    await member.voice.disconnect(
      `Déconnexion par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('📤 Membre déconnecté')
      .setDescription(
        `${member} a été déconnecté du vocal.`
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};