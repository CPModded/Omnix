import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { getGuildConfig } from '../utils/guildConfig';
export default {
  data: new SlashCommandBuilder()
    .setName('honeypot')
    .setDescription('Gérer le système Honeypot d’OMNIX')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild.toString()
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Activer le Honeypot')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Désactiver le Honeypot')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Afficher le statut du Honeypot')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configurer le Honeypot')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription(
              'Salon à utiliser comme Honeypot'
            )
            .addChannelTypes(
              ChannelType.GuildText
            )
            .setRequired(true)
        )
    ),
  async execute(
    interaction: ChatInputCommandInteraction
  ) {
    if (!interaction.guild) {
      await interaction.reply({
        content:
          '❌ Cette commande doit être utilisée dans un serveur.',
        flags: 64,
      });
      return;
    }
    /*
     * =====================================================
     * PERMISSIONS
     * =====================================================
     */
    if (
      !interaction.memberPermissions?.has(
        PermissionFlagsBits.ManageGuild
      )
    ) {
      await interaction.reply({
        content:
          '❌ Tu dois avoir la permission **Gérer le serveur** pour utiliser cette commande.',
        flags: 64,
      });
      return;
    }
    /*
     * =====================================================
     * CONFIGURATION
     * =====================================================
     */
    let config;
    try {
      config = await getGuildConfig(
        interaction.guild.id
      );
    } catch (error) {
      console.error(
        '[Honeypot] Erreur récupération configuration :',
        error
      );
      await interaction.reply({
        content:
          '❌ Impossible de récupérer la configuration du serveur.',
        flags: 64,
      });
      return;
    }
    /*
     * =====================================================
     * GARDE-FOU MODULES
     * =====================================================
     *
     * Certaines anciennes configurations MongoDB
     * peuvent ne pas encore posséder honeypot.
     */
    if (!config.modules) {
      await interaction.reply({
        content:
          '❌ La configuration des modules est indisponible. Redémarre le bot pour régénérer la configuration.',
        flags: 64,
      });
      return;
    }
    const modules =
      config.modules as Record<
        string,
        any
      >;
    /*
     * =====================================================
     * CRÉATION DU MODULE SI ABSENT
     * =====================================================
     */
    if (!modules.honeypot) {
      modules.honeypot = {
        enabled: false,
        channelId: undefined,
      };
    }
    const honeypot =
      modules.honeypot;
    const subcommand =
      interaction.options.getSubcommand();
    /*
     * =====================================================
     * ENABLE
     * =====================================================
     */
    if (subcommand === 'enable') {
      if (!honeypot.channelId) {
        await interaction.reply({
          content:
            '⚠️ Aucun salon Honeypot n’est configuré.\n\nUtilise d’abord `/honeypot setup`.',
          flags: 64,
        });
        return;
      }
      await config.updateOne({
        $set: {
          'modules.honeypot.enabled':
            true,
        },
      });
      const embed =
        new EmbedBuilder()
          .setTitle('🪤 Honeypot activé')
          .setDescription(
            'Le système Honeypot est maintenant **actif**.'
          )
          .addFields({
            name: 'Salon',
            value: `<#${honeypot.channelId}>`,
          })
          .setTimestamp();
      await interaction.reply({
        embeds: [embed],
      });
      return;
    }
    /*
     * =====================================================
     * DISABLE
     * =====================================================
     */
    if (subcommand === 'disable') {
      await config.updateOne({
        $set: {
          'modules.honeypot.enabled':
            false,
        },
      });
      const embed =
        new EmbedBuilder()
          .setTitle('🪤 Honeypot désactivé')
          .setDescription(
            'Le système Honeypot est maintenant **désactivé**.'
          )
          .setTimestamp();
      await interaction.reply({
        embeds: [embed],
      });
      return;
    }
    /*
     * =====================================================
     * STATUS
     * =====================================================
     */
    if (subcommand === 'status') {
      const enabled =
        Boolean(honeypot.enabled);
      const channelId =
        honeypot.channelId;
      const embed =
        new EmbedBuilder()
          .setTitle('🪤 Configuration Honeypot')
          .addFields(
            {
              name: 'Statut',
              value: enabled
                ? '🟢 Activé'
                : '🔴 Désactivé',
              inline: true,
            },
            {
              name: 'Salon',
              value: channelId
                ? `<#${channelId}>`
                : '❌ Non configuré',
              inline: true,
            }
          )
          .setTimestamp();
      await interaction.reply({
        embeds: [embed],
        flags: 64,
      });
      return;
    }
    /*
     * =====================================================
     * SETUP
     * =====================================================
     */
    if (subcommand === 'setup') {
      const channel =
        interaction.options.getChannel(
          'channel',
          true
        );
      await config.updateOne({
        $set: {
          'modules.honeypot.enabled':
            false,
          'modules.honeypot.channelId':
            channel.id,
        },
      });
      const embed =
        new EmbedBuilder()
          .setTitle('🪤 Honeypot configuré')
          .setDescription(
            `Le salon Honeypot a été défini sur ${channel}.`
          )
          .addFields({
            name: 'Prochaine étape',
            value:
              'Utilise `/honeypot enable` pour activer le système.',
          })
          .setTimestamp();
      await interaction.reply({
        embeds: [embed],
      });
      return;
    }
    /*
     * =====================================================
     * FALLBACK
     * =====================================================
     */
    await interaction.reply({
      content:
        '❌ Sous-commande Honeypot inconnue.',
      flags: 64,
    });
  },
};