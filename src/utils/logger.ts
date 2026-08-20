import {
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { client as botClient } from '../bot/client.ts';
import {
  logAuditEvent,
} from '../services/AuditLogger.ts';
import type {
  AuditSeverity,
  AuditStatus,
} from '../services/AuditLogger.ts';
import { CONFIG } from '../config/index.ts';
/* =========================================================
   OFFICIAL CHANNELS
========================================================= */
const OFFICIAL_CHANGELOG_CHANNEL =
  '1527176322319777832';
const OFFICIAL_PREMIUM_LOGS_CHANNEL =
  '1527176363004399766';
const OFFICIAL_PAYMENTS_LOGS_CHANNEL =
  '1527176363004399766';
/* =========================================================
   TYPES
========================================================= */
export interface LogParams {
  guildId?: string | null;
  userId: string;
  username: string;
  action: string;
  category:
    | 'user'
    | 'guild'
    | 'bot'
    | 'payment'
    | 'license'
    | 'marketplace'
    | 'security'
    | 'dashboard'
    | 'ai'
    | 'admin';
  details: string;
  ipAddress?: string | null;
  status?: AuditStatus;
  level?: AuditSeverity;
}
/* =========================================================
   OMNIX LOGGER
========================================================= */
export class OmnixLogger {
  /**
   * Enregistre une action dans MongoDB.
   */
  static async log(
    params: LogParams
  ): Promise<void> {
    try {
      await logAuditEvent({
        actorId:
          params.userId,
        actorTag:
          params.username,
        ipAddress:
          params.ipAddress ??
          undefined,
        module:
          params.category,
        action:
          params.action,
        severity:
          params.level ??
          'INFO',
        serverId:
          params.guildId ??
          undefined,
        status:
          params.status ??
          'SUCCESS',
        details: {
          message:
            params.details,
        },
      });
      /* =====================================================
         DISCORD GLOBAL LOGS
      ===================================================== */
      if (
        params.category ===
        'payment'
      ) {
        await this.sendDiscordMessage(
          OFFICIAL_PAYMENTS_LOGS_CHANNEL,
          `💳 **PAYMENT LOG** | \`@${params.username}\` — ${params.details}`
        );
      }
      if (
        params.category ===
          'license' &&
        params.action
          .toLowerCase()
          .includes('premium')
      ) {
        await this.sendDiscordMessage(
          OFFICIAL_PREMIUM_LOGS_CHANNEL,
          `💎 **PREMIUM LOG** | \`@${params.username}\` — ${params.details}`
        );
      }
    } catch (error) {
      console.error(
        '[OmnixLogger] Erreur :',
        error
      );
    }
  }
  /* =======================================================
     CHANGELOG
  ======================================================= */
  static async publishChangelog(
    type:
      | 'ajout'
      | 'suppression'
      | 'modification',
    component:
      | 'robot'
      | 'site',
    description: string
  ): Promise<void> {
    try {
      if (
        !botClient.isReady()
      ) {
        return;
      }
      const channel =
        await botClient.channels.fetch(
          OFFICIAL_CHANGELOG_CHANNEL
        );
      if (
        !channel ||
        !channel.isTextBased()
      ) {
        return;
      }
      const textChannel =
        channel as TextChannel;
      const embedColor =
        type === 'ajout'
          ? 0x10b981
          : type === 'suppression'
            ? 0xef4444
            : 0x3b82f6;
      const emoji =
        type === 'ajout'
          ? '📥'
          : type === 'suppression'
            ? '📤'
            : '⚙️';
      const embed =
        new EmbedBuilder()
          .setTitle(
            `${emoji} MISE À JOUR — OMNIX`
          )
          .setColor(
            embedColor
          )
          .addFields(
            {
              name:
                'Composant impacté',
              value:
                `\`${component.toUpperCase()}\``,
              inline: true,
            },
            {
              name:
                'Type de changement',
              value:
                `\`${type.toUpperCase()}\``,
              inline: true,
            },
            {
              name:
                'Description',
              value:
                description
                  .slice(0, 1024),
              inline: false,
            }
          )
          .setTimestamp()
          .setFooter({
            text:
              'OMNIX Auto-Changelog Engine',
          });
      await textChannel.send({
        embeds: [embed],
      });
    } catch (error) {
      console.error(
        '[OmnixLogger] Erreur publication changelog :',
        error
      );
    }
  }
  /* =======================================================
     DISCORD MESSAGE
  ======================================================= */
  private static async sendDiscordMessage(
    channelId: string,
    content: string
  ): Promise<void> {
    try {
      if (
        !botClient.isReady()
      ) {
        return;
      }
      const channel =
        await botClient.channels.fetch(
          channelId
        );
      if (
        !channel ||
        !channel.isTextBased()
      ) {
        return;
      }
      await channel.send({
        content,
      });
    } catch (error) {
      console.error(
        `[OmnixLogger] Impossible d'envoyer le log Discord (${channelId}) :`,
        error
      );
    }
  }
}
export default OmnixLogger;