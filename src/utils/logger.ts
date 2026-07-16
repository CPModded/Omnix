import { EmbedBuilder, TextChannel } from 'discord.js';
import { client as botClient } from '../bot/client';
import { AuditLog } from '../models/AuditLog';

// Configuration fixe des salons globaux OMNIX
const OFFICIAL_CHANGELOG_CHANNEL = "1527176322319777832";
const OFFICIAL_PREMIUM_LOGS_CHANNEL = "1527176363004399766";
const OFFICIAL_PAYMENTS_LOGS_CHANNEL = "1527176363004399766"; // Même salon ou séparé au choix

interface LogParams {
  guildId?: string | null;
  userId: string;
  username: string;
  action: string;
  category: 'user' | 'guild' | 'bot' | 'payment' | 'license' | 'marketplace' | 'security' | 'dashboard' | 'ai' | 'admin';
  details: string;
  ipAddress?: string | null;
  status?: 'success' | 'failure';
  level?: 'info' | 'warning' | 'error' | 'critical';
}

export class OmnixLogger {
  
  /**
   * Enregistre un événement dans l'Audit Center (MongoDB) et le distribue sur Discord
   */
  static async log(params: LogParams) {
    try {
      // 1. Sauvegarde en Base de données (Audit Center)
      const auditEntry = new AuditLog({
        guildId: params.guildId || null,
        userId: params.userId,
        username: params.username,
        action: params.action,
        category: params.category,
        details: params.details,
        ipAddress: params.ipAddress || null,
        status: params.status || 'success',
        level: params.level || 'info'
      });
      await auditEntry.save();

      // 2. Traitement des cas spécifiques de logs globaux d'OMNIX
      if (params.category === 'payment') {
        await this.sendDiscordWebhook(OFFICIAL_PAYMENTS_LOGS_CHANNEL, `💳 **PAYMENT LOG** | \`@${params.username}\` - ${params.details}`);
      }

      if (params.category === 'license' && params.action.includes('premium')) {
        await this.sendDiscordWebhook(OFFICIAL_PREMIUM_LOGS_CHANNEL, `💎 **PREMIUM LOG** | \`@${params.username}\` - ${params.details}`);
      }
    } catch (err: any) {
      console.error('[OmnixLogger Core Error] :', err.message);
    }
  }

  /**
   * Publie automatiquement un changelog de développement
   */
  static async publishChangelog(type: 'ajout' | 'suppression' | 'modification', component: 'robot' | 'site', desc: string) {
    try {
      const channel = await botClient.channels.fetch(OFFICIAL_CHANGELOG_CHANNEL) as TextChannel;
      if (!channel) return;

      const embedColor = type === 'ajout' ? 0x10b981 : type === 'suppression' ? 0xef4444 : 0x3b82f6;
      const emoji = type === 'ajout' ? '📥' : type === 'suppression' ? '📤' : '⚙️';

      const changelogEmbed = new EmbedBuilder()
        .setTitle(`${emoji} MISE À JOUR — CONSOLE SÉCURISÉE`)
        .setColor(embedColor)
        .addFields(
          { name: 'Composant impacté', value: `\`${component.toUpperCase()}\``, inline: true },
          { name: 'Type de changement', value: `\`${type.toUpperCase()}\``, inline: true },
          { name: 'Description des modifications', value: desc, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'OMNIX Auto-Changelog Engine' });

      await channel.send({ embeds: [changelogEmbed] });
    } catch (err: any) {
      console.error('[Changelog Publish Error] :', err.message);
    }
  }

  private static async sendDiscordWebhook(channelId: string, content: string) {
    try {
      const channel = await botClient.channels.fetch(channelId) as TextChannel;
      if (channel) {
        await channel.send({ content });
      }
    } catch (e: any) {
      console.error(`[Discord Log Dispatch Error] salon: ${channelId} :`, e.message);
    }
  }
}