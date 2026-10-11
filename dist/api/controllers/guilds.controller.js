"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuildsController = void 0;
exports.invalidateUserGuildsCache = invalidateUserGuildsCache;
exports.invalidateAllUserGuildsCache = invalidateAllUserGuildsCache;
const axios_1 = __importDefault(require("axios"));
const discord_js_1 = require("discord.js");
const client_1 = require("../../bot/client");
const User_1 = require("../../models/User");
const License_1 = require("../../models/License");
const GuildConfig_1 = require("../../models/GuildConfig");
const auth_routes_1 = require("../routes/auth.routes");
/* =========================================================
   CACHE
========================================================= */
function invalidateUserGuildsCache(userId) {
    userGuildsCache.delete(String(userId));
}
function invalidateAllUserGuildsCache() {
    userGuildsCache.clear();
}
const userGuildsCache = new Map();
const CACHE_DURATION = 60 * 1000;
/* =========================================================
   HELPERS
========================================================= */
function isAdministrator(permissions) {
    if (typeof permissions !== 'string') {
        return false;
    }
    try {
        const value = BigInt(permissions);
        const ADMINISTRATOR = 0x8n;
        return ((value & ADMINISTRATOR) ===
            ADMINISTRATOR);
    }
    catch {
        return false;
    }
}
/* =========================================================
   INVITE URL
========================================================= */
function createBotInviteUrl(guildId) {
    const clientId = process.env.DISCORD_CLIENT_ID ||
        process.env.DISCORD_APPLICATION_ID;
    if (!clientId) {
        return '#';
    }
    const params = new URLSearchParams({
        client_id: clientId,
        scope: 'bot applications.commands',
        permissions: '8',
        guild_id: guildId,
    });
    return (`https://discord.com/oauth2/authorize?${params.toString()}`);
}
/* =========================================================
   CONTROLLER
========================================================= */
class GuildsController {
    /* =======================================================
       GET USER GUILDS
       
       GET /api/guilds
    ======================================================= */
    static async getUserGuilds(req, res) {
        const userId = req.user?.discordId;
        const username = req.user?.username ||
            'unknown';
        console.log(`[Guilds] 📥 Récupération des serveurs Discord pour : ${username}`);
        if (!userId) {
            return res
                .status(401)
                .json({
                success: false,
                error: 'Authentification requise.',
                code: 'AUTH_REQUIRED',
            });
        }
        /* =====================================================
           CACHE
        ===================================================== */
        const cached = userGuildsCache.get(userId);
        const forceRefresh = String(req.query?.refresh || '') === '1';
        if (!forceRefresh &&
            cached &&
            cached.expiresAt >
                Date.now()) {
            return res.json({
                success: true,
                guilds: cached.guilds,
            });
        }
        try {
            /* ===================================================
               GET USER FROM MONGODB
            =================================================== */
            const user = await User_1.User.findOne({
                discordId: userId,
            }).lean();
            if (!user) {
                return res
                    .status(404)
                    .json({
                    success: false,
                    error: 'Utilisateur OMNIX introuvable.',
                    code: 'USER_NOT_FOUND',
                });
            }
            let storedGuilds = Array.isArray(user.guilds)
                ? user.guilds
                : [];
            // Synchronisation légère avec Discord : elle permet au Dashboard de
            // retrouver un nouveau serveur sans attendre une nouvelle connexion.
            // Le refresh token reste strictement côté serveur.
            let needsReauth = false;
            try {
                const accessToken = await (0, auth_routes_1.refreshDiscordAccessToken)(String(userId));
                if (accessToken) {
                    const live = await axios_1.default.get('https://discord.com/api/v10/users/@me/guilds', {
                        headers: { Authorization: `Bearer ${accessToken}` },
                        timeout: 10000,
                    });
                    if (Array.isArray(live.data)) {
                        storedGuilds = live.data.map((guild) => ({
                            id: String(guild.id),
                            name: String(guild.name),
                            icon: guild.icon || null,
                            owner: Boolean(guild.owner),
                            permissions: String(guild.permissions || '0'),
                            features: Array.isArray(guild.features) ? guild.features : [],
                        }));
                        await User_1.User.updateOne({ discordId: String(userId) }, { $set: { guilds: storedGuilds } }).catch(() => null);
                    }
                }
                else if (user.refreshToken) {
                    needsReauth = true;
                }
            }
            catch (syncError) {
                console.warn('[Guilds] Synchronisation Discord différée :', syncError?.response?.status || syncError?.message || syncError);
            }
            /* ===================================================
               ONLY ADMINISTRABLE SERVERS
            =================================================== */
            const adminGuilds = storedGuilds.filter((guild) => {
                if (guild.owner === true) {
                    return true;
                }
                return isAdministrator(guild.permissions);
            });
            /* ===================================================
               BUILD DASHBOARD DATA
            =================================================== */
            const activeLicenses = await License_1.License.find({
                buyerId: userId,
                status: { $in: ['active', 'used'] },
                $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
            }).sort({ createdAt: -1 }).lean().catch(() => []);
            const activatedGuildIds = new Set();
            for (const license of activeLicenses) {
                if (license.activatedGuildId)
                    activatedGuildIds.add(String(license.activatedGuildId));
                for (const id of Array.isArray(license.activatedGuildIds) ? license.activatedGuildIds : []) {
                    activatedGuildIds.add(String(id));
                }
            }
            const guildIds = adminGuilds.map((guild) => String(guild.id));
            const guildConfigs = await GuildConfig_1.GuildConfig.find({ guildId: { $in: guildIds } })
                .select('guildId plan premium premiumExpiresAt')
                .lean()
                .catch(() => []);
            const configByGuild = new Map(guildConfigs.map(config => [String(config.guildId), config]));
            const result = adminGuilds.map((guild) => {
                const botGuild = client_1.client.guilds.cache.get(guild.id);
                const botPresent = Boolean(botGuild);
                const stored = configByGuild.get(String(guild.id));
                const expiresAt = stored?.premium?.expiresAt || stored?.premiumExpiresAt || null;
                const configPremium = Boolean((stored?.premium?.isPremium || (stored?.plan && stored.plan !== 'free')) &&
                    (!expiresAt || new Date(expiresAt).getTime() > Date.now()));
                const licensePremium = activatedGuildIds.has(String(guild.id));
                const premium = configPremium || licensePremium;
                const licenseForGuild = activeLicenses.find(license => String(license.activatedGuildId || '') === String(guild.id) ||
                    (Array.isArray(license.activatedGuildIds) && license.activatedGuildIds.map(String).includes(String(guild.id))));
                return {
                    id: guild.id,
                    name: guild.name,
                    icon: guild.icon || null,
                    owner: Boolean(guild.owner),
                    permissions: guild.permissions || '0',
                    manageable: true,
                    botPresent,
                    inviteUrl: createBotInviteUrl(guild.id),
                    premium,
                    // Expose the resolved plan explicitly so the dashboard can
                    // render a deterministic PREMIUM/FREE badge after reconnect.
                    plan: premium ? (stored?.premium?.tier || stored?.plan || licenseForGuild?.tier || 'premium') : 'free',
                    premiumTier: premium ? (stored?.premium?.tier || licenseForGuild?.tier || 'premium') : null,
                    premiumExpiresAt: premium ? (expiresAt || licenseForGuild?.expiresAt || null) : null,
                };
            });
            /* ===================================================
               ACCESS CACHE
            =================================================== */
            /* ===================================================
               RESULT CACHE
            =================================================== */
            userGuildsCache.set(userId, {
                guilds: result,
                expiresAt: Date.now() +
                    CACHE_DURATION,
            });
            console.log(`[Guilds] ✓ ${result.length} serveur(s) administrable(s) trouvé(s) pour ${username}`);
            return res.json({
                success: true,
                guilds: result,
                total: result.length,
            });
        }
        catch (error) {
            console.error('[Guilds] ❌ Erreur récupération serveurs :', error);
            if (cached) {
                return res.json({
                    success: true,
                    guilds: cached.guilds,
                    cached: true,
                });
            }
            return res
                .status(500)
                .json({
                success: false,
                error: 'Impossible de récupérer vos serveurs Discord.',
                code: 'GUILDS_FETCH_FAILED',
            });
        }
    }
    /* =======================================================
       GET CHANNELS
       
       GET /api/guilds/:guildId/channels
    ======================================================= */
    static async getGuildChannels(req, res) {
        const { guildId, } = req.params;
        try {
            const guild = await client_1.client.guilds.fetch(guildId).catch(() => null);
            if (!guild) {
                return res
                    .status(404)
                    .json({
                    success: false,
                    error: 'OMNIX n’est pas présent sur ce serveur.',
                    code: 'BOT_NOT_IN_GUILD',
                });
            }
            const channels = await guild.channels.fetch();
            const formatted = channels
                .filter((channel) => channel !== null &&
                (channel.type ===
                    discord_js_1.ChannelType.GuildText ||
                    channel.type ===
                        discord_js_1.ChannelType.GuildCategory ||
                    channel.type ===
                        discord_js_1.ChannelType.GuildAnnouncement))
                .map((channel) => ({
                id: channel.id,
                name: channel.name,
                type: channel.type,
                parentId: channel.parentId ||
                    null,
            }));
            return res.json({
                success: true,
                guildId,
                channels: formatted,
            });
        }
        catch (error) {
            console.error(`[Guilds] ❌ Channels ${guildId}:`, error);
            return res
                .status(500)
                .json({
                success: false,
                error: 'Impossible de récupérer les salons.',
            });
        }
    }
    /* =======================================================
       GET ROLES
       
       GET /api/guilds/:guildId/roles
    ======================================================= */
    static async getGuildRoles(req, res) {
        const { guildId, } = req.params;
        try {
            const guild = await client_1.client.guilds.fetch(guildId).catch(() => null);
            if (!guild) {
                return res
                    .status(404)
                    .json({
                    success: false,
                    error: 'OMNIX n’est pas présent sur ce serveur.',
                });
            }
            const roles = await guild.roles.fetch();
            const formatted = roles
                .filter((role) => role !== null &&
                role.id !==
                    guild.id)
                .sort((a, b) => b.position -
                a.position)
                .map((role) => ({
                id: role.id,
                name: role.name,
                color: role.hexColor,
                position: role.position,
                managed: role.managed,
            }));
            return res.json({
                success: true,
                guildId,
                roles: formatted,
            });
        }
        catch (error) {
            console.error(`[Guilds] ❌ Roles ${guildId}:`, error);
            return res
                .status(500)
                .json({
                success: false,
                error: 'Impossible de récupérer les rôles.',
            });
        }
    }
}
exports.GuildsController = GuildsController;
