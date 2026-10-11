import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('user-info')
    .setDescription('Affiche les informations d’un utilisateur')
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Utilisateur à consulter')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Cette commande doit être utilisée sur un serveur.',
        ephemeral: true,
      });
    }

    const user =
      interaction.options.getUser('membre') ??
      interaction.user;

    const member = await guild.members
      .fetch(user.id)
      .catch(() => null);

    const roles =
      member?.roles.cache
        .filter(role => role.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString())
        .slice(0, 15)
        .join(', ') || 'Aucun';

    const embed = new EmbedBuilder()
      .setColor(member?.displayHexColor || 0x5865f2)
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(
        user.displayAvatarURL({
          size: 1024,
        })
      )
      .addFields(
        {
          name: '🆔 ID',
          value: `\`${user.id}\``,
          inline: true,
        },
        {
          name: '🤖 Bot',
          value: user.bot ? 'Oui' : 'Non',
          inline: true,
        },
        {
          name: '📅 Compte créé',
          value: `<t:${Math.floor(
            user.createdTimestamp / 1000
          )}:F>`,
          inline: true,
        },
        {
          name: '📥 Arrivée',
          value: member?.joinedTimestamp
            ? `<t:${Math.floor(
                member.joinedTimestamp / 1000
              )}:F>`
            : 'Inconnu',
          inline: true,
        },
        {
          name: '🎭 Rôles',
          value: roles,
        }
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};