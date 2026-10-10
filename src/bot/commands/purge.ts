import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Supprime des messages selon un filtre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option =>
      option
        .setName('nombre')
        .setDescription('Nombre maximum de messages à analyser')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Supprimer uniquement les messages de ce membre')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('bots')
        .setDescription('Supprimer uniquement les messages des bots')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.channel;

    if (
      !interaction.guild ||
      !channel ||
      !('messages' in channel) ||
      !('bulkDelete' in channel)
    ) {
      return interaction.reply({
        content: '❌ Ce salon ne permet pas cette opération.',
        ephemeral: true,
      });
    }

    const amount = interaction.options.getInteger('nombre', true);
    const target = interaction.options.getUser('membre');
    const botsOnly = interaction.options.getBoolean('bots') ?? false;

    const messages = await channel.messages.fetch({
      limit: amount,
    });

    const filtered = messages.filter(message => {
      if (target && message.author.id !== target.id) {
        return false;
      }

      if (botsOnly && !message.author.bot) {
        return false;
      }

      return true;
    });

    if (filtered.size === 0) {
      return interaction.reply({
        content: 'ℹ️ Aucun message correspondant au filtre.',
        ephemeral: true,
      });
    }

    const deleted = await channel
      .bulkDelete(filtered, true)
      .catch(() => null);

    if (!deleted) {
      return interaction.reply({
        content:
          '❌ Impossible de supprimer les messages.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🧹 Purge terminée')
      .setDescription(
        `**${deleted.size}** message(s) ont été supprimé(s).`
      )
      .addFields({
        name: '🛡️ Modérateur',
        value: interaction.user.tag,
        inline: true,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};