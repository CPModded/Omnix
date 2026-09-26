import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Affiche la latence d’OMNIX'),

  async execute(
    interaction: ChatInputCommandInteraction
  ) {
    try {
      const client = interaction.client;

      // Latence WebSocket Discord
      const wsPing = client.ws?.ping ?? -1;

      // Temps aller-retour de l'interaction
      const start = Date.now();

      await interaction.reply({
        content: '🏓 Calcul de la latence...',
      });

      const apiPing =
        Date.now() - start;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🏓 OMNIX — Pong!')
        .addFields(
          {
            name: '🌐 WebSocket',
            value:
              wsPing >= 0
                ? `\`${wsPing} ms\``
                : '`Indisponible`',
            inline: true,
          },
          {
            name: '⚡ API',
            value: `\`${apiPing} ms\``,
            inline: true,
          },
          {
            name: '🤖 Statut',
            value: '🟢 Opérationnel',
            inline: true,
          }
        )
        .setFooter({
          text:
            interaction.guild?.name ??
            'OMNIX',
        })
        .setTimestamp();

      return interaction.editReply({
        content: '',
        embeds: [embed],
      });
    } catch (error) {
      console.error(
        '[Ping] Exception :',
        error
      );

      if (
        interaction.replied ||
        interaction.deferred
      ) {
        return interaction.editReply({
          content:
            '❌ Impossible de récupérer la latence d’OMNIX.',
        });
      }

      return interaction.reply({
        content:
          '❌ Impossible de récupérer la latence d’OMNIX.',
        ephemeral: true,
      });
    }
  },
};