"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStatsDiscordClient = registerStatsDiscordClient;
exports.getStats = getStats;
exports.health = health;
const User_1 = require("../../models/User");
let discordClient = null;
const startedAt = Date.now();
/**
 * Enregistre le client Discord.
 */
function registerStatsDiscordClient(client) {
    discordClient = client;
    console.log('[StatsController] Client Discord enregistré.');
}
/**
 * Retourne le nombre de commandes OMNIX.
 */
function getCommandCount() {
    const globalValue = globalThis.__OMNIX_COMMAND_COUNT;
    if (typeof globalValue === 'number' &&
        Number.isFinite(globalValue)) {
        return Math.max(0, Math.floor(globalValue));
    }
    const envValue = Number(process.env.OMNIX_COMMAND_COUNT ?? 0);
    return Number.isFinite(envValue)
        ? Math.max(0, Math.floor(envValue))
        : 0;
}
/**
 * Statistiques Discord.
 */
function getDiscordStats() {
    if (!discordClient) {
        return {
            connected: false,
            guildsCount: 0,
            membersCount: 0,
            ping: 0,
        };
    }
    let membersCount = 0;
    for (const guild of discordClient.guilds.cache.values()) {
        membersCount += Number(guild.memberCount ?? 0);
    }
    const ping = Number(discordClient.ws.ping);
    return {
        connected: discordClient.isReady(),
        guildsCount: discordClient.guilds.cache.size,
        membersCount,
        ping: Number.isFinite(ping) && ping >= 0
            ? Math.round(ping)
            : 0,
    };
}
/**
 * GET /api/stats
 */
async function getStats(_req, res) {
    const started = Date.now();
    try {
        const discord = getDiscordStats();
        let totalUsers = 0;
        try {
            totalUsers =
                await User_1.User.countDocuments();
        }
        catch (error) {
            console.warn('[StatsController] MongoDB:', error);
        }
        const latency = Date.now() - started;
        return res.json({
            success: true,
            bot: {
                guildsCount: discord.guildsCount,
                membersCount: discord.membersCount,
                ping: discord.ping,
                connected: discord.connected,
                uptime: Math.floor((Date.now() - startedAt) /
                    1000),
            },
            database: {
                totalUsers,
                latency,
            },
            commands: getCommandCount(),
            api: {
                latency,
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('[StatsController] Erreur:', error);
        return res.status(500).json({
            success: false,
            error: 'Impossible de récupérer les statistiques.',
        });
    }
}
/**
 * GET /api/stats/health
 */
function health(_req, res) {
    const discord = getDiscordStats();
    return res.status(discord.connected ? 200 : 503).json({
        success: discord.connected,
        service: 'OMNIX',
        status: discord.connected
            ? 'online'
            : 'degraded',
        discord: discord.connected
            ? 'connected'
            : 'disconnected',
        timestamp: new Date().toISOString(),
    });
}
