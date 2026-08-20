import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Avertit un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre à avertir')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('raison')
        .setDescription('Raison de l’avertissement')
        .setMaxLength(500)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ Cette commande doit être utilisée sur un serveur.',
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser('membre', true);
    const reason =
      interaction.options.getString('raison') ??
      'Aucune raison fournie';

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ Tu ne peux pas te donner un avertissement.',
        ephemeral: true,
      });
    }

    const member = await interaction.guild.members
      .fetch(target.id)
      .catch(() => null);

    if (!member) {
      return interaction.reply({
        content: '❌ Ce membre n’est pas présent sur le serveur.',
        ephemeral: true,
      });
    }

    const executor = await interaction.guild.members
      .fetch(interaction.user.id);

    if (
      member.roles.highest.position >=
      executor.roles.highest.position
    ) {
      return interaction.reply({
        content:
          '❌ Tu ne peux pas avertir un membre ayant un rôle égal ou supérieur au tien.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('⚠️ Avertissement')
      .setDescription(
        `${target} a reçu un avertissement.`
      )
      .addFields(
        {
          name: '👤 Membre',
          value: `${target.tag}\n\`${target.id}\``,
          inline: true,
        },
        {
          name: '🛡️ Modérateur',
          value: interaction.user.tag,
          inline: true,
        },
        {
          name: '📝 Raison',
          value: reason,
        }
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};