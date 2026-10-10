import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('massban')
    .setDescription('Bannit plusieurs utilisateurs par leurs IDs')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(option =>
      option
        .setName('ids')
        .setDescription('IDs Discord séparés par des espaces ou des virgules')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('raison')
        .setDescription('Raison du bannissement')
        .setMaxLength(500)
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

    const idsInput = interaction.options.getString('ids', true);
    const reason =
      interaction.options.getString('raison') ??
      'Massban OMNIX';

    const executor = await guild.members.fetch(
      interaction.user.id
    );

    if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content:
          '❌ Tu n’as pas la permission **Bannir des membres**.',
        ephemeral: true,
      });
    }

    const ids = [
      ...new Set(
        idsInput
          .split(/[\s,;]+/)
          .map(id => id.trim())
          .filter(id => /^\d{17,20}$/.test(id))
      ),
    ];

    if (!ids.length) {
      return interaction.reply({
        content: '❌ Aucun ID Discord valide n’a été fourni.',
        ephemeral: true,
      });
    }

    if (ids.length > 25) {
      return interaction.reply({
        content:
          '❌ Maximum **25 utilisateurs** par opération.',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    let success = 0;
    let failed = 0;
    const failures: string[] = [];

    for (const id of ids) {
      try {
        const member = await guild.members
          .fetch(id)
          .catch(() => null);

        if (member) {
          if (
            member.id === interaction.user.id ||
            member.id === interaction.client.user.id
          ) {
            failed++;
            failures.push(`${id} : cible protégée`);
            continue;
          }

          if (
            executor.id !== guild.ownerId &&
            member.roles.highest.position >=
              executor.roles.highest.position
          ) {
            failed++;
            failures.push(`${id} : rôle supérieur ou égal`);
            continue;
          }

          const botMember = guild.members.me;

          if (
            botMember &&
            member.roles.highest.position >=
              botMember.roles.highest.position
          ) {
            failed++;
            failures.push(`${id} : rôle trop élevé pour OMNIX`);
            continue;
          }
        }

        await guild.members.ban(id, {
          reason: `${reason} | Par ${interaction.user.tag}`,
          deleteMessageSeconds: 0,
        });

        success++;
      } catch {
        failed++;
        failures.push(`${id} : impossible à bannir`);
      }
    }

    const failureText =
      failures.length > 0
        ? `\n\n**❌ Échecs :**\n${failures
            .slice(0, 10)
            .map(item => `• ${item}`)
            .join('\n')}`
        : '';

    const embed = new EmbedBuilder()
      .setColor(failed === 0 ? 0x57f287 : 0xffa500)
      .setTitle('🔨 Massban terminé')
      .setDescription(
        `L’opération de bannissement est terminée.${failureText}`
      )
      .addFields(
        {
          name: '✅ Bannissements',
          value: `**${success}**`,
          inline: true,
        },
        {
          name: '❌ Échecs',
          value: `**${failed}**`,
          inline: true,
        },
        {
          name: '📊 Total',
          value: `**${ids.length}**`,
          inline: true,
        },
        {
          name: '📝 Raison',
          value: reason,
        }
      )
      .setFooter({
        text: `OMNIX • Massban par ${interaction.user.tag}`,
      })
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
    });
  },
};