import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('channel-rename')
    .setDescription('Renomme un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option =>
      option
        .setName('salon')
        .setDescription('Salon à renommer')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('nom')
        .setDescription('Nouveau nom')
        .setMaxLength(100)
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel(
      'salon',
      true
    );

    const newName = interaction.options.getString(
      'nom',
      true
    );

    const oldName = channel.name;

    await channel.setName(
      newName,
      `Renommé par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('✏️ Salon renommé')
      .addFields(
        {
          name: 'Avant',
          value: oldName,
          inline: true,
        },
        {
          name: 'Après',
          value: newName,
          inline: true,
        }
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};