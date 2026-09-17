import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unmute-voice')
    .setDescription('Retire le mute vocal d’un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre ciblé')
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
      false,
      `Unmute vocal par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🔊 Mute vocal retiré')
      .setDescription(`${member} peut maintenant parler.`)
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};