import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Rend un membre muet dans un salon vocal')
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre à rendre muet')
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

    await member.voice.setMute(
      true,
      `Mute vocal par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🔇 Membre mute')
      .setDescription(`${member} est maintenant muet.`)
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};