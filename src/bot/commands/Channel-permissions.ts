import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('channel-permissions')
    .setDescription('Modifie une permission dans un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option =>
      option
        .setName('salon')
        .setDescription('Salon concerné')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Rôle concerné')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('permission')
        .setDescription('Permission à modifier')
        .setRequired(true)
        .addChoices(
          {
            name: 'Voir le salon',
            value: 'ViewChannel',
          },
          {
            name: 'Envoyer des messages',
            value: 'SendMessages',
          },
          {
            name: 'Ajouter des réactions',
            value: 'AddReactions',
          },
          {
            name: 'Gérer les messages',
            value: 'ManageMessages',
          },
          {
            name: 'Joindre des fichiers',
            value: 'AttachFiles',
          },
          {
            name: 'Mentionner everyone',
            value: 'MentionEveryone',
          }
        )
    )
    .addStringOption(option =>
      option
        .setName('valeur')
        .setDescription('Autoriser ou refuser')
        .setRequired(true)
        .addChoices(
          {
            name: 'Autoriser',
            value: 'allow',
          },
          {
            name: 'Refuser',
            value: 'deny',
          },
          {
            name: 'Réinitialiser',
            value: 'neutral',
          }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel(
      'salon',
      true
    );

    const role = interaction.options.getRole(
      'role',
      true
    );

    const permission = interaction.options.getString(
      'permission',
      true
    ) as any;

    const value = interaction.options.getString(
      'valeur',
      true
    );

    if (!('permissionOverwrites' in channel)) {
      return interaction.reply({
        content:
          '❌ Ce salon ne supporte pas les permissions.',
        ephemeral: true,
      });
    }

    let permissionValue: boolean | null;

    if (value === 'allow') {
      permissionValue = true;
    } else if (value === 'deny') {
      permissionValue = false;
    } else {
      permissionValue = null;
    }

    await channel.permissionOverwrites.edit(
      role.id,
      {
        [permission]: permissionValue,
      },
      {
        reason: `Permission modifiée par ${interaction.user.tag}`,
      }
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🔐 Permission modifiée')
      .setDescription(
        `La permission **${permission}** de ${role} dans ${channel} a été modifiée.`
      )
      .addFields({
        name: 'État',
        value:
          value === 'allow'
            ? '✅ Autorisée'
            : value === 'deny'
              ? '❌ Refusée'
              : '🔄 Réinitialisée',
        inline: true,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  },
};