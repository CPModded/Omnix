import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('deafen')
    .setDescription('Rend un membre sourd dans un salon vocal')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.DeafenMembers
    )
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre à rendre sourd')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.options.getMember('membre');

    if (
      !member ||
      !('voice' in member)
    ) {
      return interaction.reply({
        content: '❌ Membre introuvable.',
        ephemeral: true,
      });
    }

    if (!member.voice.channel) {
      return interaction.reply({
        content:
          '❌ Ce membre n’est pas dans un salon vocal.',
        ephemeral: true,
      });
    }

    await member.voice.setDeaf(
      true,
      `Deafen par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🔇 Membre rendu sourd')
      .setDescription(
        `${member} est maintenant sourd dans le vocal.`
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};