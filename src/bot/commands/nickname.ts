import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('Modifie le pseudo d’un membre')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageNicknames
    )
    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre ciblé')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('pseudo')
        .setDescription('Nouveau pseudo')
        .setMaxLength(32)
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Serveur introuvable.',
        ephemeral: true,
      });
    }

    const target = await guild.members
      .fetch(interaction.options.getUser('membre', true).id)
      .catch(() => null);

    const nickname = interaction.options.getString(
      'pseudo',
      true
    );

    if (!target) {
      return interaction.reply({
        content: '❌ Membre introuvable.',
        ephemeral: true,
      });
    }

    const executor = await guild.members.fetch(
      interaction.user.id
    );

    if (
      target.roles.highest.position >=
        executor.roles.highest.position &&
      executor.id !== guild.ownerId
    ) {
      return interaction.reply({
        content:
          '❌ Tu ne peux pas modifier le pseudo d’un membre ayant un rôle égal ou supérieur au tien.',
        ephemeral: true,
      });
    }

    const oldNickname =
      target.nickname ?? target.user.username;

    await target.setNickname(
      nickname,
      `Pseudo modifié par ${interaction.user.tag}`
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('✏️ Pseudo modifié')
      .addFields(
        {
          name: '👤 Membre',
          value: target.toString(),
          inline: true,
        },
        {
          name: 'Avant',
          value: oldNickname,
          inline: true,
        },
        {
          name: 'Après',
          value: nickname,
          inline: true,
        }
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};