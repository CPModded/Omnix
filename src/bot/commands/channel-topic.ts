import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('channel-topic')
    .setDescription('Modifie le sujet d’un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option =>
      option
        .setName('salon')
        .setDescription('Salon concerné')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('sujet')
        .setDescription('Nouveau sujet')
        .setMaxLength(1024)
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel(
      'salon',
      true
    );

    const topic = interaction.options.getString(
      'sujet',
      true
    );

    if (!('setTopic' in channel)) {
      return interaction.reply({
        content:
          '❌ Ce type de salon ne permet pas de définir un sujet.',
        ephemeral: true,
      });
    }

    await channel.setTopic(
      topic,
      `Sujet modifié par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('📝 Sujet modifié')
      .setDescription(
        `Le sujet de ${channel} a été mis à jour.`
      )
      .addFields({
        name: '📝 Nouveau sujet',
        value: topic,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};