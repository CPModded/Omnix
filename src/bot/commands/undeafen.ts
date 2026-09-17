import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('undeafen')
    .setDescription('Retire le deaf d’un membre')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.DeafenMembers
    )
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre ciblé')
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
      false,
      `Undeafen par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🔊 Deaf retiré')
      .setDescription(
        `${member} peut maintenant entendre normalement.`
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};