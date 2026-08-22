import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Affiche les informations d’invitation du serveur'),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Cette commande doit être utilisée sur un serveur.',
        ephemeral: true,
      });
    }

    const me = guild.members.me;

    if (!me?.permissions.has('CreateInstantInvite')) {
      return interaction.reply({
        content:
          '❌ OMNIX n’a pas la permission **Créer une invitation**.',
        ephemeral: true,
      });
    }

    const channel =
      guild.channels.cache.find(channel =>
        channel.isTextBased() &&
        channel.isSendable()
      );

    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        content:
          '❌ Aucun salon compatible n’a été trouvé pour créer une invitation.',
        ephemeral: true,
      });
    }

    const invite = await channel
      .createInvite({
        maxAge: 0,
        maxUses: 0,
        unique: true,
        reason: `Invitation générée par ${interaction.user.tag}`,
      })
      .catch(() => null);

    if (!invite) {
      return interaction.reply({
        content:
          '❌ Impossible de créer une invitation. Vérifie les permissions d’OMNIX.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🔗 Invitation du serveur')
      .setDescription(
        `Voici une invitation permanente vers **${guild.name}** :\n\n` +
        `### ${invite.url}`
      )
      .addFields({
        name: '📊 Utilisation',
        value: '♾️ Illimitée',
        inline: true,
      }, {
        name: '⏱️ Expiration',
        value: '♾️ Jamais',
        inline: true,
      })
      .setThumbnail(
        guild.iconURL({ size: 512 })
      )
      .setFooter({
        text: `OMNIX • ${guild.name}`,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};