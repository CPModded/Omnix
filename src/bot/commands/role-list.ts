import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('role-list')
    .setDescription('Affiche la liste des rôles'),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    const roles = [...guild.roles.cache.values()]
      .filter(role => role.id !== guild.id)
      .sort((a, b) => b.position - a.position);

    const list = roles
      .slice(0, 50)
      .map(
        (role, index) =>
          `**${index + 1}.** ${role} — \`${role.id}\``
      )
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🎭 Rôles — ${guild.name}`)
      .setDescription(
        list || 'Aucun rôle personnalisé.'
      )
      .setFooter({
        text: `${roles.length} rôle(s) personnalisé(s)`,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};