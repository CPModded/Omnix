"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const User_1 = require("../../models/User");
const GuildConfig_1 = __importDefault(require("../../models/GuildConfig"));
const PlatformEvent_1 = __importDefault(require("../../models/PlatformEvent"));
const client_1 = require("../../bot/client");
const auth_routes_1 = require("./auth.routes");
const router = express_1.default.Router();
const LIVE_DISCORD_CLIENT = () => globalThis.omnixDiscordClient || client_1.client;
function getGuildIconUrl(guildId, icon) {
    if (!icon)
        return null;
    const value = String(icon);
    if (/^https?:\/\//i.test(value))
        return value;
    return `https://cdn.discordapp.com/icons/${guildId}/${value}.png?size=128`;
}
/*
 * =========================================================
 * OMNIX — GUILD ROUTES
 * =========================================================
 *
 * Routes :
 *
 * GET /api/guilds
 * GET /api/guilds/:guildId
 * GET /api/guilds/:guildId/channels
 * GET /api/guilds/:guildId/roles
 * GET /api/guilds/:guildId/invite
 *
 * Auth :
 *
 * jwt_token cookie
 * OU
 * Authorization: Bearer ...
 *
 * =========================================================
 */
/* =========================================================
   CONFIGURATION
========================================================= */
const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_BOT_TOKEN = process.env.DISCORD_TOKEN ||
    process.env.DISCORD_BOT_TOKEN ||
    process.env.OMNIX_BOT_TOKEN ||
    process.env.BOT_TOKEN ||
    '';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID ||
    process.env.CLIENT_ID ||
    '';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI ||
    '';
/* =========================================================
   HELPERS
========================================================= */
/**
 * Récupère l'utilisateur connecté depuis le JWT.
 */
async function getAuthenticatedUser(req) {
    const token = (0, auth_routes_1.getRequestToken)(req);
    if (!token) {
        return null;
    }
    const payload = (0, auth_routes_1.verifyJwt)(token);
    if (!payload?.discordId) {
        return null;
    }
    const user = await User_1.User.findOne({
        discordId: payload.discordId,
    });
    return user;
}
/**
 * Convertit un objet guild MongoDB
 * vers un format propre pour le frontend.
 */
function normalizeGuild(guild) {
    const id = String(guild?.id || guild?.guildId || '');
    return {
        id,
        name: String(guild?.name || 'Serveur Discord'),
        icon: getGuildIconUrl(id, guild?.icon),
        owner: Boolean(guild?.owner),
        permissions: String(guild?.permissions || '0'),
        features: Array.isArray(guild?.features) ? guild.features : [],
        memberCount: Number(guild?.memberCount ?? guild?.approximate_member_count ?? guild?.approximateMemberCount ?? 0),
    };
}
/**
 * Vérifie que l'utilisateur possède
 * bien accès à la guild.
 */
function userCanManageGuild(user, guildId) {
    if (!user) {
        return false;
    }
    const guilds = Array.isArray(user.guilds)
        ? user.guilds
        : [];
    const guild = guilds.find((item) => String(item?.id ||
        item?.guildId ||
        '') === guildId);
    if (!guild) {
        return false;
    }
    /*
     * Owner.
     */
    if (guild.owner === true) {
        return true;
    }
    /*
     * Administrator.
     */
    const permissions = String(guild.permissions ||
        '0');
    try {
        const value = BigInt(permissions);
        const ADMINISTRATOR = 0x8n;
        return ((value &
            ADMINISTRATOR) ===
            ADMINISTRATOR);
    }
    catch {
        return false;
    }
}
/**
 * Vérifie si OMNIX est présent
 * sur un serveur.
 */
async function isBotInGuild(guildId) {
    const liveClient = LIVE_DISCORD_CLIENT();
    if (liveClient?.guilds?.cache?.has?.(String(guildId)))
        return true;
    if (!DISCORD_BOT_TOKEN)
        return false;
    try {
        await axios_1.default.get(`${DISCORD_API}/guilds/${guildId}`, {
            headers: {
                Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            },
            timeout: 8000,
        });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * URL d'invitation OMNIX.
 */
function getBotInviteUrl(guildId) {
    if (!DISCORD_CLIENT_ID) {
        return null;
    }
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        scope: 'bot applications.commands',
        permissions: '8',
    });
    /*
     * Si Discord connaît déjà le serveur,
     * on ouvre directement le sélecteur avec
     * le serveur présélectionné.
     */
    if (guildId) {
        params.set('guild_id', guildId);
    }
    return (`https://discord.com/oauth2/authorize?${params.toString()}`);
}
/**
 * Récupère une guild précise depuis
 * la liste sauvegardée de l'utilisateur.
 */
function findUserGuild(user, guildId) {
    const guilds = Array.isArray(user?.guilds)
        ? user.guilds
        : [];
    return (guilds.find((guild) => String(guild?.id ||
        guild?.guildId ||
        '') === guildId) ||
        null);
}
/* =========================================================
   GET /api/guilds
========================================================= */
router.get('/', async (req, res) => {
    try {
        console.log('[Guilds] 📥 Récupération des serveurs Discord');
        const user = await getAuthenticatedUser(req);
        if (!user) {
            console.warn('[Guilds] ❌ Utilisateur non authentifié.');
            return res.status(401).json({
                success: false,
                error: 'Authentification requise.',
                code: 'AUTH_REQUIRED',
                guilds: [],
            });
        }
        let rawGuilds = Array.isArray(user.guilds)
            ? user.guilds
            : [];
        /*
         * La liste Discord sauvegardée peut être vide/ancienne.
         * On la rafraîchit depuis OAuth lorsque le token est encore valide.
         * Le token n'est jamais envoyé au frontend.
         */
        if (rawGuilds.length === 0 || Boolean(req.query.refresh)) {
            try {
                let accessToken = await (0, auth_routes_1.refreshDiscordAccessToken)(String(user.discordId));
                if (!accessToken)
                    throw new Error('Token Discord OAuth absent ou expiré.');
                let response = await axios_1.default.get(`${DISCORD_API}/users/@me/guilds?with_counts=true`, { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 12000 });
                if (response.status === 401) {
                    accessToken = await (0, auth_routes_1.refreshDiscordAccessToken)(String(user.discordId));
                    if (!accessToken)
                        throw new Error('Impossible de renouveler le token Discord.');
                    response = await axios_1.default.get(`${DISCORD_API}/users/@me/guilds?with_counts=true`, { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 12000 });
                }
                if (Array.isArray(response.data)) {
                    rawGuilds = response.data.filter((g) => {
                        if (g?.owner === true || g?.owner === 'true')
                            return true;
                        try {
                            return (BigInt(String(g?.permissions ?? '0')) & 0x8n) === 0x8n;
                        }
                        catch {
                            return false;
                        }
                    }).map((g) => ({
                        id: String(g.id), name: String(g.name || 'Serveur Discord'), icon: g.icon || null,
                        owner: g.owner === true || g.owner === 'true', permissions: String(g.permissions ?? '0'),
                        memberCount: Number(g.member_count ?? g.approximate_member_count ?? g.approximateMemberCount ?? 0),
                        features: Array.isArray(g.features) ? g.features : [],
                    }));
                    await User_1.User.updateOne({ discordId: String(user.discordId) }, { $set: { guilds: rawGuilds } });
                }
            }
            catch (refreshError) {
                console.warn('[Guilds] Rafraîchissement Discord impossible:', refreshError?.response?.data || refreshError?.message || refreshError);
            }
        }
        const liveClient = LIVE_DISCORD_CLIENT();
        const adminGuilds = rawGuilds.filter((g) => {
            if (g?.owner === true || g?.owner === 'true')
                return true;
            try {
                const permissions = BigInt(String(g?.permissions ?? '0'));
                return (permissions & 0x8n) === 0x8n;
            }
            catch {
                return false;
            }
        });
        const guilds = adminGuilds
            .map((g) => {
            const id = String(g?.id || g?.guildId || '');
            const live = liveClient?.guilds?.cache?.get?.(id);
            return normalizeGuild({
                ...g,
                memberCount: Number(live?.memberCount ?? g?.memberCount ?? g?.approximate_member_count ?? g?.approximateMemberCount ?? 0),
                name: live?.name || g?.name,
                icon: live?.icon || g?.icon,
            });
        })
            .filter((guild) => Boolean(guild.id));
        console.log(`[Guilds] ✓ ${guilds.length} serveur(s) pour : ${user.username}`);
        /*
         * On vérifie uniquement les guilds
         * si nécessaire.
         *
         * Ne pas appeler Discord pour chaque guild
         * à chaque chargement du dashboard.
         */
        const guildConfigs = await GuildConfig_1.default.find({ guildId: { $in: guilds.map((g) => String(g.id)) } }).select('guildId blacklisted blacklistReason').lean().catch(() => []);
        const configByGuild = new Map(guildConfigs.map((c) => [String(c.guildId), c]));
        const result = await Promise.all(guilds.map(async (guild) => {
            const liveClient = LIVE_DISCORD_CLIENT();
            const liveGuild = liveClient?.guilds?.cache?.get(guild.id);
            // The cache may be cold during startup or after reconnect. A cache miss
            // is not proof that the bot was removed: verify against Discord REST.
            const botPresent = Boolean(liveGuild) || await isBotInGuild(guild.id);
            return {
                ...guild,
                memberCount: Number(liveGuild?.memberCount ?? guild.memberCount ?? guild?.approximate_member_count ?? 0),
                inviteUrl: botPresent ? null : getBotInviteUrl(guild.id),
                botInvite: botPresent ? null : getBotInviteUrl(guild.id),
                botPresent,
                botInstalled: botPresent,
                blacklisted: Boolean(configByGuild.get(String(guild.id))?.blacklisted),
                blacklistReason: configByGuild.get(String(guild.id))?.blacklistReason || null,
            };
        }));
        return res.json({
            success: true,
            guilds: result,
            count: result.length,
            total: result.length,
        });
    }
    catch (error) {
        console.error('[Guilds] ❌ Erreur /api/guilds :', error);
        return res.status(500).json({
            success: false,
            error: 'Impossible de récupérer vos serveurs Discord.',
            code: 'GUILDS_FETCH_ERROR',
            guilds: [],
        });
    }
});
/* =========================================================
   GET /api/guilds/:guildId/activity
========================================================= */
router.get('/:guildId/activity', async (req, res) => {
    try {
        const guildId = String(req.params.guildId || '').trim();
        const user = await getAuthenticatedUser(req);
        if (!user)
            return res.status(401).json({ success: false, error: 'Authentification requise.' });
        if (!findUserGuild(user, guildId) || !userCanManageGuild(user, guildId))
            return res.status(403).json({ success: false, error: 'Accès refusé.' });
        const data = await PlatformEvent_1.default.find({ guildId }).sort({ createdAt: -1 }).limit(250).lean();
        return res.json({ success: true, data });
    }
    catch (error) {
        console.error('[Guild activity]', error);
        return res.status(500).json({ success: false, error: 'Impossible de charger l’activité du serveur.' });
    }
});
/* =========================================================
   GET /api/guilds/:guildId/statistics
========================================================= */
router.get('/:guildId/statistics', async (req, res) => {
    try {
        const guildId = String(req.params.guildId || '').trim();
        const user = await getAuthenticatedUser(req);
        if (!user)
            return res.status(401).json({ success: false, error: 'Authentification requise.' });
        if (!findUserGuild(user, guildId) || !userCanManageGuild(user, guildId))
            return res.status(403).json({ success: false, error: 'Accès refusé.' });
        const guild = LIVE_DISCORD_CLIENT()?.guilds?.cache?.get?.(guildId);
        const [joins, leaves, aiRequests, commands] = await Promise.all([
            PlatformEvent_1.default.countDocuments({ guildId, type: 'member_joined' }),
            PlatformEvent_1.default.countDocuments({ guildId, type: 'member_left' }),
            PlatformEvent_1.default.countDocuments({ guildId, type: 'ai_request' }),
            PlatformEvent_1.default.countDocuments({ guildId, type: 'command_executed' })
        ]);
        const active = guild?.members?.cache ? guild.members.cache.filter((m) => m.presence?.status && m.presence.status !== 'offline').size : 0;
        return res.json({ success: true, guild: { id: guildId, name: guild?.name || findUserGuild(user, guildId)?.name || 'Serveur Discord', memberCount: Number(guild?.memberCount || 0) }, statistics: { joins, leaves, active, aiRequests, commands } });
    }
    catch (error) {
        console.error('[Guild statistics]', error);
        return res.status(500).json({ success: false, error: 'Impossible de charger les statistiques du serveur.' });
    }
});
/* =========================================================
   GET /api/guilds/:guildId
========================================================= */
router.get('/:guildId', async (req, res) => {
    try {
        const guildId = String(req.params.guildId ||
            '').trim();
        if (!/^\d{17,20}$/.test(guildId)) {
            return res.status(400).json({
                success: false,
                error: 'Identifiant de serveur Discord invalide.',
                code: 'INVALID_GUILD_ID',
            });
        }
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Authentification requise.',
                code: 'AUTH_REQUIRED',
            });
        }
        const userGuild = findUserGuild(user, guildId);
        if (!userGuild) {
            return res.status(403).json({
                success: false,
                error: 'Vous ne pouvez pas gérer ce serveur.',
                code: 'GUILD_ACCESS_DENIED',
            });
        }
        const manageable = userCanManageGuild(user, guildId);
        if (!manageable) {
            return res.status(403).json({
                success: false,
                error: 'Vous devez être propriétaire ou administrateur du serveur.',
                code: 'GUILD_PERMISSION_DENIED',
            });
        }
        /*
         * Configuration OMNIX.
         */
        let config = null;
        try {
            config =
                await GuildConfig_1.default.findOne({
                    guildId,
                }).lean();
        }
        catch (error) {
            console.warn(`[Guilds] Configuration MongoDB indisponible pour ${guildId}:`, error);
        }
        /*
         * Vérification de présence du bot.
         */
        if (config?.blacklisted)
            return res.status(403).json({ success: false, error: 'Ce serveur est blacklisté par OMNIX.', code: 'GUILD_BLACKLISTED' });
        const botPresent = await isBotInGuild(guildId);
        const guild = normalizeGuild(userGuild);
        return res.json({
            success: true,
            guild: {
                ...guild,
                botPresent,
                botInstalled: botPresent,
                inviteUrl: botPresent
                    ? null
                    : getBotInviteUrl(guildId),
                botInvite: botPresent
                    ? null
                    : getBotInviteUrl(guildId),
            },
            config: config || {
                guildId,
                exists: false,
            },
        });
    }
    catch (error) {
        console.error('[Guilds] ❌ Erreur /:guildId :', error);
        return res.status(500).json({
            success: false,
            error: 'Impossible de récupérer la configuration du serveur.',
            code: 'GUILD_FETCH_ERROR',
        });
    }
});
/* =========================================================
   GET /api/guilds/:guildId/channels
========================================================= */
router.get('/:guildId/channels', async (req, res) => {
    try {
        const guildId = String(req.params.guildId ||
            '').trim();
        if (!/^\d{17,20}$/.test(guildId)) {
            return res.status(400).json({
                success: false,
                error: 'Identifiant de serveur invalide.',
                channels: [],
            });
        }
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Authentification requise.',
                code: 'AUTH_REQUIRED',
                channels: [],
            });
        }
        if (!userCanManageGuild(user, guildId)) {
            return res.status(403).json({
                success: false,
                error: 'Accès refusé à ce serveur.',
                code: 'GUILD_ACCESS_DENIED',
                channels: [],
            });
        }
        if (!DISCORD_BOT_TOKEN) {
            return res.status(503).json({
                success: false,
                error: 'Token du bot Discord non configuré.',
                code: 'BOT_TOKEN_MISSING',
                channels: [],
            });
        }
        const response = await axios_1.default.get(`${DISCORD_API}/guilds/${guildId}/channels`, {
            headers: {
                Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            },
            timeout: 10000,
        });
        const channels = Array.isArray(response.data)
            ? response.data
            : [];
        return res.json({
            success: true,
            guildId,
            channels: channels
                .map((channel) => ({
                id: channel.id,
                name: channel.name,
                type: channel.type,
                parentId: channel.parent_id ||
                    null,
                position: Number(channel.position ??
                    0),
            }))
                .sort((a, b) => a.position -
                b.position),
        });
    }
    catch (error) {
        console.error('[Guilds] ❌ Channels :', error?.response?.data ||
            error?.message ||
            error);
        return res.status(error?.response?.status ===
            404
            ? 404
            : 500).json({
            success: false,
            error: 'Impossible de récupérer les salons Discord.',
            code: 'CHANNELS_FETCH_ERROR',
            channels: [],
        });
    }
});
/* =========================================================
   GET /api/guilds/:guildId/roles
========================================================= */
router.get('/:guildId/roles', async (req, res) => {
    try {
        const guildId = String(req.params.guildId ||
            '').trim();
        if (!/^\d{17,20}$/.test(guildId)) {
            return res.status(400).json({
                success: false,
                error: 'Identifiant de serveur invalide.',
                roles: [],
            });
        }
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Authentification requise.',
                code: 'AUTH_REQUIRED',
                roles: [],
            });
        }
        if (!userCanManageGuild(user, guildId)) {
            return res.status(403).json({
                success: false,
                error: 'Accès refusé à ce serveur.',
                code: 'GUILD_ACCESS_DENIED',
                roles: [],
            });
        }
        if (!DISCORD_BOT_TOKEN) {
            return res.status(503).json({
                success: false,
                error: 'Token du bot Discord non configuré.',
                code: 'BOT_TOKEN_MISSING',
                roles: [],
            });
        }
        const response = await axios_1.default.get(`${DISCORD_API}/guilds/${guildId}/roles`, {
            headers: {
                Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            },
            timeout: 10000,
        });
        const roles = Array.isArray(response.data)
            ? response.data
            : [];
        return res.json({
            success: true,
            guildId,
            roles: roles
                .map((role) => ({
                id: role.id,
                name: role.name,
                color: Number(role.color ??
                    0),
                position: Number(role.position ??
                    0),
                permissions: String(role.permissions ||
                    '0'),
                managed: Boolean(role.managed),
            }))
                .sort((a, b) => b.position -
                a.position),
        });
    }
    catch (error) {
        console.error('[Guilds] ❌ Roles :', error?.response?.data ||
            error?.message ||
            error);
        return res.status(error?.response?.status ===
            404
            ? 404
            : 500).json({
            success: false,
            error: 'Impossible de récupérer les rôles Discord.',
            code: 'ROLES_FETCH_ERROR',
            roles: [],
        });
    }
});
/* =========================================================
   GET /api/guilds/:guildId/invite
========================================================= */
router.get('/:guildId/invite', async (req, res) => {
    try {
        const guildId = String(req.params.guildId ||
            '').trim();
        if (!/^\d{17,20}$/.test(guildId)) {
            return res.status(400).json({
                success: false,
                error: 'Identifiant de serveur invalide.',
                code: 'INVALID_GUILD_ID',
            });
        }
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Authentification requise.',
                code: 'AUTH_REQUIRED',
            });
        }
        if (!userCanManageGuild(user, guildId)) {
            return res.status(403).json({
                success: false,
                error: 'Vous ne pouvez pas inviter OMNIX sur ce serveur.',
                code: 'GUILD_ACCESS_DENIED',
            });
        }
        const inviteUrl = getBotInviteUrl(guildId);
        if (!inviteUrl) {
            return res.status(500).json({
                success: false,
                error: 'DISCORD_CLIENT_ID est manquant.',
                code: 'DISCORD_CLIENT_ID_MISSING',
            });
        }
        return res.json({
            success: true,
            guildId,
            inviteUrl,
            url: inviteUrl,
        });
    }
    catch (error) {
        console.error('[Guilds] ❌ Invite :', error);
        return res.status(500).json({
            success: false,
            error: 'Impossible de générer le lien d’invitation OMNIX.',
            code: 'INVITE_ERROR',
        });
    }
});
/* =========================================================
   EXPORT
========================================================= */
exports.default = router;
