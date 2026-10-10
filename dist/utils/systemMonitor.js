"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemMonitor = void 0;
const os_1 = __importDefault(require("os"));
const client_1 = require("../bot/client");
const User_1 = __importDefault(require("../models/User"));
const GuildConfig_1 = __importDefault(require("../models/GuildConfig"));
class SystemMonitor {
    static async getStats() {
        // =========================================================
        // SYSTEME
        // =========================================================
        const totalMem = os_1.default.totalmem();
        const freeMem = os_1.default.freemem();
        const memUsagePercent = Number((((totalMem - freeMem) / totalMem) *
            100).toFixed(2));
        // =========================================================
        // DISCORD
        // =========================================================
        const guilds = client_1.client.guilds.cache;
        const guildsCount = guilds.size;
        let membersCount = 0;
        for (const guild of guilds.values()) {
            membersCount += guild.memberCount || 0;
        }
        const usersCached = client_1.client.users.cache.size;
        const ping = client_1.client.ws.ping >= 0
            ? client_1.client.ws.ping
            : 0;
        // =========================================================
        // MONGODB
        // =========================================================
        let totalUsers = 0;
        let premiumGuilds = 0;
        let totalGuildConfigs = 0;
        try {
            totalUsers =
                await User_1.default.countDocuments();
            totalGuildConfigs =
                await GuildConfig_1.default.countDocuments();
            premiumGuilds =
                await GuildConfig_1.default.countDocuments({
                    'premium.isPremium': true,
                });
        }
        catch (error) {
            console.error('[SystemMonitor] Erreur MongoDB :', error);
        }
        // =========================================================
        // RESULTAT
        // =========================================================
        return {
            system: {
                cpuLoad: os_1.default.loadavg(),
                totalMem: Math.round(totalMem / 1024 / 1024),
                freeMem: Math.round(freeMem / 1024 / 1024),
                memUsagePercent,
                uptime: os_1.default.uptime(),
            },
            bot: {
                ping,
                guildsCount,
                membersCount,
                usersCached,
                uptime: process.uptime(),
            },
            database: {
                totalUsers,
                premiumGuilds,
                totalGuildConfigs,
            },
        };
    }
}
exports.SystemMonitor = SystemMonitor;
exports.default = SystemMonitor;
