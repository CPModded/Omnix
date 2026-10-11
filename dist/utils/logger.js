"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OmnixLogger = void 0;
const discord_js_1 = require("discord.js");
const client_1 = require("../bot/client");
const AuditLogger_1 = require("../services/AuditLogger");
/* =========================================================
   OFFICIAL CHANNELS
========================================================= */
const OFFICIAL_CHANGELOG_CHANNEL = '1527176322319777832';
const OFFICIAL_PREMIUM_LOGS_CHANNEL = '1527176363004399766';
const OFFICIAL_PAYMENTS_LOGS_CHANNEL = '1527176363004399766';
/* =========================================================
   OMNIX LOGGER
========================================================= */
class OmnixLogger {
    /**
     * Enregistre une action dans MongoDB.
     */
    static async log(params) {
        try {
            await (0, AuditLogger_1.logAuditEvent)({
                actorId: params.userId,
                actorTag: params.username,
                ipAddress: params.ipAddress ??
                    undefined,
                module: params.category,
                action: params.action,
                severity: params.level ??
                    'INFO',
                serverId: params.guildId ??
                    undefined,
                status: params.status ??
                    'SUCCESS',
                details: {
                    message: params.details,
                },
            });
            /* =====================================================
               DISCORD GLOBAL LOGS
            ===================================================== */
            if (params.category ===
                'payment') {
                await this.sendDiscordMessage(OFFICIAL_PAYMENTS_LOGS_CHANNEL, `💳 **PAYMENT LOG** | \`@${params.username}\` — ${params.details}`);
            }
            if (params.category ===
                'license' &&
                params.action
                    .toLowerCase()
                    .includes('premium')) {
                await this.sendDiscordMessage(OFFICIAL_PREMIUM_LOGS_CHANNEL, `💎 **PREMIUM LOG** | \`@${params.username}\` — ${params.details}`);
            }
        }
        catch (error) {
            console.error('[OmnixLogger] Erreur :', error);
        }
    }
    /* =======================================================
       CHANGELOG
    ======================================================= */
    static async publishChangelog(type, component, description) {
        try {
            if (!client_1.client.isReady()) {
                return;
            }
            const channel = await client_1.client.channels.fetch(OFFICIAL_CHANGELOG_CHANNEL);
            if (!channel ||
                !channel.isTextBased()) {
                return;
            }
            const textChannel = channel;
            const embedColor = type === 'ajout'
                ? 0x10b981
                : type === 'suppression'
                    ? 0xef4444
                    : 0x3b82f6;
            const emoji = type === 'ajout'
                ? '📥'
                : type === 'suppression'
                    ? '📤'
                    : '⚙️';
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`${emoji} MISE À JOUR — OMNIX`)
                .setColor(embedColor)
                .addFields({
                name: 'Composant impacté',
                value: `\`${component.toUpperCase()}\``,
                inline: true,
            }, {
                name: 'Type de changement',
                value: `\`${type.toUpperCase()}\``,
                inline: true,
            }, {
                name: 'Description',
                value: description
                    .slice(0, 1024),
                inline: false,
            })
                .setTimestamp()
                .setFooter({
                text: 'OMNIX Auto-Changelog Engine',
            });
            await textChannel.send({
                embeds: [embed],
            });
        }
        catch (error) {
            console.error('[OmnixLogger] Erreur publication changelog :', error);
        }
    }
    /* =======================================================
       DISCORD MESSAGE
    ======================================================= */
    static async sendDiscordMessage(channelId, content) {
        try {
            if (!client_1.client.isReady()) {
                return;
            }
            const channel = await client_1.client.channels.fetch(channelId);
            if (!channel ||
                !channel.isTextBased()) {
                return;
            }
            await channel.send({
                content,
            });
        }
        catch (error) {
            console.error(`[OmnixLogger] Impossible d'envoyer le log Discord (${channelId}) :`, error);
        }
    }
}
exports.OmnixLogger = OmnixLogger;
exports.default = OmnixLogger;
