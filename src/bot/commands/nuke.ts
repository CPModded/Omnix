import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Recrée le salon actuel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addBooleanOption(option =>
      option
        .setName('confirmation')
        .setDescription('Confirme la recréation du salon')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.channel;

    if (
      !interaction.guild ||
      !channel ||
      !('clone' in channel)
    ) {
      return interaction.reply({
        content:
          '❌ Ce salon ne peut pas être recréé.',
        ephemeral: true,
      });
    }

    const confirmation =
      interaction.options.getBoolean(
        'confirmation',
        true
      );

    if (!confirmation) {
      return interaction.reply({
        content: '❌ Opération annulée.',
        ephemeral: true,
      });
    }

    await interaction.reply({
      content: '💣 Recréation du salon en cours...',
      ephemeral: true,
    });

    const oldChannel = channel;

    const newChannel = await oldChannel.clone({
      reason: `Nuke par ${interaction.user.tag}`,
    });

    await newChannel.setPosition(
      oldChannel.position
    );

    await oldChannel.delete(
      `Nuke par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('💣 Salon recréé')
      .setDescription(
        `Le salon **${newChannel.name}** vient d’être recréé.`
      )
      .setFooter({
        text: `OMNIX • ${interaction.user.tag}`,
      })
      .setTimestamp();

    await newChannel.send({
      embeds: [embed],
    });
  },
};