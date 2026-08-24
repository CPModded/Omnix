import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('role-info')
    .setDescription('Affiche les informations d’un rôle')
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Rôle à consulter')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const role = interaction.options.getRole('role', true);

    const embed = new EmbedBuilder()
      .setColor(role.color || 0x5865f2)
      .setTitle(`🎭 ${role.name}`)
      .addFields(
        {
          name: '🆔 ID',
          value: `\`${role.id}\``,
          inline: true,
        },
        {
          name: '📊 Position',
          value: `${role.position}`,
          inline: true,
        },
        {
          name: '🎨 Couleur',
          value: role.hexColor,
          inline: true,
        },
        {
          name: '🔔 Mentionnable',
          value: role.mentionable ? 'Oui' : 'Non',
          inline: true,
        },
        {
          name: '🔗 Intégration',
          value: role.managed ? 'Oui' : 'Non',
          inline: true,
        },
        {
          name: '📌 Membres',
          value: `${role.members.size}`,
          inline: true,
        }
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};