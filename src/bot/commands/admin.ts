import {
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

import type {
  Command,
  CommandContext,
} from '../types';

import { CONFIG } from '../../config/index';

import { User } from '../../models/User';
import { GuildConfig } from '../../models/GuildConfig';
import { License } from '../../models/License';
import crypto from 'node:crypto';

import { SystemMonitor } from '../../utils/systemMonitor';

/**
 * ====================================================================
 * OMNIX — ADMIN CONSOLE
 * ====================================================================
 *
 * Commande réservée aux Owners configurés dans OWNER_IDS.
 *
 * Variables attendues :
 *
 * OWNER_IDS=123456789012345678
 *
 * Plusieurs Owners :
 *
 * OWNER_IDS=123456789012345678,987654321098765432
 *
 * ====================================================================
 */

function getOwnerIds(): string[] {
  const owners = Array.isArray(CONFIG.OWNER_IDS)
    ? CONFIG.OWNER_IDS
    : [];

  return owners
    .map((id) => String(id).trim())
    .filter(Boolean);
}

function isOmnixOwner(userId: string): boolean {
  const ownerIds = getOwnerIds();

  return ownerIds.includes(
    String(userId).trim()
  );
}

const adminCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription(
      'Console d’administration globale OMNIX'
    )

    /*
     * =========================================================
     * USER PREMIUM
     * =========================================================
     */

    .addSubcommand((sub) =>
      sub
        .setName('user-premium')
        .setDescription(
          'Modifier le Premium d’un utilisateur'
        )

        .addUserOption((option) =>
          option
            .setName('target')
            .setDescription(
              'Utilisateur concerné'
            )
            .setRequired(true)
        )

        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription(
              'Action à effectuer'
            )
            .setRequired(true)
            .addChoices(
              {
                name: 'Donner',
                value: 'give',
              },
              {
                name: 'Retirer',
                value: 'remove',
              }
            )
        )

        .addIntegerOption((option) =>
          option
            .setName('duration')
            .setDescription(
              'Durée en jours. 0 = Lifetime'
            )
            .setRequired(true)
            .setMinValue(0)
        )
    )

    /*
     * =========================================================
     * GUILD PREMIUM
     * =========================================================
     */

    .addSubcommand((sub) =>
      sub
        .setName('guild-premium')
        .setDescription(
          'Modifier le Premium d’un serveur'
        )

        .addStringOption((option) =>
          option
            .setName('guild_id')
            .setDescription(
              'ID du serveur Discord'
            )
            .setRequired(true)
        )

        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription(
              'Action à effectuer'
            )
            .setRequired(true)
            .addChoices(
              {
                name: 'Donner',
                value: 'give',
              },
              {
                name: 'Retirer',
                value: 'remove',
              }
            )
        )

        .addIntegerOption((option) =>
          option
            .setName('duration')
            .setDescription(
              'Durée en jours. 0 = Lifetime'
            )
            .setRequired(true)
            .setMinValue(0)
        )
    )

    /*
     * =========================================================
     * BLACKLIST
     * =========================================================
     */

    .addSubcommand((sub) =>
      sub
        .setName('blacklist')
        .setDescription(
          'Blacklist ou déblacklist un utilisateur'
        )

        .addUserOption((option) =>
          option
            .setName('target')
            .setDescription(
              'Utilisateur concerné'
            )
            .setRequired(true)
        )

        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription(
              'Action'
            )
            .setRequired(true)
            .addChoices(
              {
                name: 'Blacklister',
                value: 'add',
              },
              {
                name: 'Déblacklister',
                value: 'remove',
              }
            )
        )

        .addStringOption((option) =>
          option
            .setName('reason')
            .setDescription(
              'Raison de la sanction'
            )
        )
    )

    /*
     * =========================================================
     * SYSTEM STATS
     * =========================================================
     */

    .addSubcommand((sub) =>
      sub
        .setName('system-stats')
        .setDescription(
          'Afficher les statistiques système OMNIX'
        )
    )

    /*
     * =========================================================
     * GLOBAL ANNOUNCE
     * =========================================================
     */

    .addSubcommand((sub) =>
      sub
        .setName('global-announce')
        .setDescription(
          'Envoyer une annonce sur les serveurs'
        )

        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription(
              'Message à diffuser'
            )
            .setRequired(true)
        )
    ) as any,

  /*
   * =========================================================
   * EXECUTION
   * =========================================================
   */

  async execute({
    interaction,
  }: CommandContext) {
    const userId =
      String(interaction.user.id);

    // Acknowledge the Discord interaction immediately. Admin commands
    // perform database/network work and must never wait before the first ACK.
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ flags: 64 });
    }

    /*
     * =======================================================
     * SECURITY CHECK
     * =======================================================
     */

    const ownerIds =
      getOwnerIds();

    const authorized =
      ownerIds.includes(userId);

    console.log(
      `[ADMIN] User ID: ${userId}`
    );

    console.log(
      `[ADMIN] OWNER_IDS: ${ownerIds.join(', ') || 'AUCUN'}`
    );

    console.log(
      `[ADMIN] Autorisé: ${authorized}`
    );

    if (!authorized) {
      return interaction.editReply({
        content: '❌ Accès refusé. Cette commande est strictement réservée au Staff OMNIX.',
      });
    }

    /*
     * =======================================================
     * SUBCOMMAND
     * =======================================================
     */

    const subcommand =
      interaction.options.getSubcommand();

    /*
     * =======================================================
     * USER PREMIUM
     * =======================================================
     */

    if (subcommand === 'user-premium') {
      const target = interaction.options.getUser('target', true);
      const action = interaction.options.getString('action', true);
      const duration = interaction.options.getInteger('duration', true);
      try {
        const userDb = await User.findOne({ discordId: target.id });
        if (!userDb) return interaction.editReply({ content: '❌ Cet utilisateur ne s’est jamais connecté au Dashboard OMNIX.' });
        if (action === 'remove') {
          await License.updateMany({ buyerId: target.id, status: 'active' }, { $set: { status: 'suspended' } });
          userDb.isPremium = false; await userDb.save();
          return interaction.editReply({ content: `✅ Premium retiré de **${target.username}**.` });
        }
        const expiresAt = duration > 0 ? new Date(Date.now() + duration * 86400000) : null;
        const key = `OMNIX-USER-${crypto.randomBytes(10).toString('hex').toUpperCase()}`;
        await License.create({ key, tier: duration === 0 ? 'lifetime' : 'premium', status:'active', buyerId:target.id, activatedGuildId:null, activatedAt:null, expiresAt, durationInDays:duration });
        userDb.isPremium = true; await userDb.save();
        return interaction.editReply({ content: `✅ Premium accordé à **${target.username}**.\n\n• Licence : \`${key}\`\n• Durée : \`${duration === 0 ? 'À vie' : `${duration} jours`}\`` });
      } catch (e:any) { console.error('[ADMIN] User Premium:',e); return interaction.editReply({ content:`❌ Erreur : ${e?.message ?? 'Erreur inconnue'}` }); }
    }

    /*
     * =======================================================
     * GUILD PREMIUM
     * =======================================================
     */

    if (
      subcommand ===
      'guild-premium'
    ) {

      const guildId =
        interaction.options.getString(
          'guild_id',
          true
        );

      const action =
        interaction.options.getString(
          'action',
          true
        );

      const duration =
        interaction.options.getInteger(
          'duration',
          true
        );

      try {
        let config =
          await GuildConfig.findOne({
            guildId,
          });

        if (!config) {
          config =
            new GuildConfig({
              guildId,
            });
        }

        if (
          !config.premium
        ) {
          config.premium = {
            isPremium: false,
            tier: 'free',
            expiresAt: null,
          };
        }

        if (
          action === 'remove'
        ) {
          config.premium.isPremium =
            false;

          config.premium.tier =
            'free';

          config.premium.expiresAt =
            null;

          await config.save();

          return interaction.editReply({
            content:
              `✅ Premium retiré du serveur \`${guildId}\`.`,
          });
        }

        let expiresAt:
          | Date
          | null = null;

        if (duration > 0) {
          expiresAt =
            new Date();

          expiresAt.setDate(
            expiresAt.getDate() +
              duration
          );
        }

        config.premium.isPremium =
          true;

        config.premium.tier =
          duration === 0
            ? 'lifetime'
            : 'premium';

        config.premium.expiresAt =
          expiresAt;

        await config.save();

        return interaction.editReply({
          content:
            `✅ Premium serveur activé.\n\n` +
            `• Serveur : \`${guildId}\`\n` +
            `• Durée : \`${duration === 0 ? 'À vie' : `${duration} jours`}\`\n` +
            `• Statut : \`ACTIF\``,
        });

      } catch (error: any) {
        console.error(
          '[ADMIN] Guild Premium:',
          error
        );

        return interaction.editReply({
          content:
            `❌ Erreur Premium serveur : ${error?.message ?? 'Erreur inconnue'}`,
        });
      }
    }

    /*
     * =======================================================
     * BLACKLIST
     * =======================================================
     */

    if (
      subcommand ===
      'blacklist'
    ) {

      const target =
        interaction.options.getUser(
          'target',
          true
        );

      const action =
        interaction.options.getString(
          'action',
          true
        );

      const reason =
        interaction.options.getString(
          'reason'
        ) ||
        'Aucune raison fournie.';

      try {
        const userDb =
          await User.findOne({
            discordId: target.id,
          });

        if (!userDb) {
          return interaction.editReply({
            content:
              "❌ Cet utilisateur n’existe pas encore dans la base OMNIX.",
          });
        }

        if (
          userDb.isAdmin &&
          action === 'add'
        ) {
          return interaction.editReply({
            content:
              '❌ Impossible de blacklister un administrateur OMNIX.',
          });
        }

        userDb.isBlacklisted =
          action === 'add';

        await userDb.save();

        return interaction.editReply({
          content:
            `${action === 'add' ? '🛑' : '✅'} **Blacklist mise à jour**\n\n` +
            `• Utilisateur : **${target.username}**\n` +
            `• Statut : \`${action === 'add' ? 'BLACKLISTÉ' : 'AUTORISÉ'}\`\n` +
            `• Raison : ${reason}`,
        });

      } catch (error: any) {
        console.error(
          '[ADMIN] Blacklist:',
          error
        );

        return interaction.editReply({
          content:
            `❌ Erreur blacklist : ${error?.message ?? 'Erreur inconnue'}`,
        });
      }
    }

    /*
     * =======================================================
     * SYSTEM STATS
     * =======================================================
     */

    if (
      subcommand ===
      'system-stats'
    ) {

      try {
        const stats =
          await SystemMonitor.getStats();

        const cpu =
          stats.system.cpuLoad?.[0] ?? 0;

        const embed =
          new EmbedBuilder()
            .setTitle(
              '🛡️ Console système OMNIX'
            )
            .setDescription(
              'État actuel de l’infrastructure OMNIX.'
            )
            .setColor(
              0x7c3aed
            )
            .addFields(
              {
                name:
                  '💻 CPU',
                value:
                  `\`${cpu.toFixed(2)}\``,
                inline: true,
              },
              {
                name:
                  '💾 RAM',
                value:
                  `\`${stats.system.memUsagePercent}%\``,
                inline: true,
              },
              {
                name:
                  '⚡ Ping Discord',
                value:
                  `\`${stats.bot.ping}ms\``,
                inline: true,
              },
              {
                name:
                  '🌐 Serveurs',
                value:
                  `\`${stats.bot.guildsCount}\``,
                inline: true,
              },
              {
                name:
                  '👤 Utilisateurs DB',
                value:
                  `\`${stats.database.totalUsers}\``,
                inline: true,
              },
              {
                name:
                  '💎 Serveurs Premium',
                value:
                  `\`${stats.database.premiumGuilds}\``,
                inline: true,
              }
            )
            .setTimestamp();

        return interaction.editReply({
          embeds: [embed],
        });

      } catch (error: any) {
        console.error(
          '[ADMIN] System Stats:',
          error
        );

        return interaction.editReply({
          content:
            `❌ Impossible de récupérer les statistiques : ${error?.message ?? 'Erreur inconnue'}`,
        });
      }
    }

    /*
     * =======================================================
     * GLOBAL ANNOUNCE
     * =======================================================
     */

    if (
      subcommand ===
      'global-announce'
    ) {

      const message =
        interaction.options.getString(
          'message',
          true
        );

      let sent = 0;
      let failed = 0;

      for (
        const guild
        of interaction.client.guilds.cache.values()
      ) {
        try {
          const me =
            guild.members.me;

          if (!me) {
            failed++;
            continue;
          }

          const channel =
            guild.systemChannel ??
            guild.channels.cache.find(
              (channel: any) =>
                channel.isTextBased() &&
                channel
                  .permissionsFor(me)
                  ?.has('SendMessages')
            );

          if (
            !channel ||
            !('send' in channel)
          ) {
            failed++;
            continue;
          }

          await channel.send({
            content:
              `📢 **Annonce Globale OMNIX**\n\n${message}`,
          });

          sent++;

        } catch {
          failed++;
        }
      }

      return interaction.editReply({
        content:
          `📢 **Annonce globale terminée.**\n\n` +
          `✅ Envoyées : \`${sent}\`\n` +
          `❌ Échecs : \`${failed}\``,
      });
    }

    /*
     * =======================================================
     * UNKNOWN SUBCOMMAND
     * =======================================================
     */

    return interaction.editReply({
      content: '❌ Sous-commande administrateur inconnue.',
    });
  },
};

export default adminCommand;