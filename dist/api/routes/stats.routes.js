"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const User_1 = require("../../models/User");
const AiLog_1 = __importDefault(require("../../models/AiLog"));
const AiSession_1 = __importDefault(require("../../models/AiSession"));
const PlatformEvent_1 = __importDefault(require("../../models/PlatformEvent"));
const auth_routes_1 = require("./auth.routes");
const router = express_1.default.Router();
const client = () => globalThis.omnixDiscordClient;
function range(req) {
    const end = req.query.end ? new Date(String(req.query.end)) : new Date();
    const start = req.query.start ? new Date(String(req.query.start)) : new Date(end.getTime() - 30 * 86400000);
    return { start, end };
}
function currentUser(req) {
    const t = (0, auth_routes_1.getRequestToken)(req);
    return t ? (0, auth_routes_1.verifyJwt)(t) : null;
}
function safePing(c) {
    return Number.isFinite(c?.ws?.ping) && c.ws.ping >= 0 ? Math.round(c.ws.ping) : null;
}
function accessibleGuildIds(userDoc) {
    return Array.isArray(userDoc?.guilds) ? userDoc.guilds.map((g) => String(g?.id || '')).filter(Boolean) : [];
}
function liveGuilds(ids) {
    const c = client();
    return ids.map(id => c?.guilds?.cache?.get?.(id)).filter(Boolean);
}
router.get('/stats', async (req, res) => {
    try {
        const c = client();
        const payload = currentUser(req);
        const botGuilds = c?.guilds?.cache ? [...c.guilds.cache.values()] : [];
        const globalMembers = botGuilds.reduce((n, g) => n + Number(g?.memberCount || 0), 0);
        const globalGuildCount = botGuilds.length;
        const commandCount = Number(c?.commands?.size || 0);
        if (!payload?.discordId) {
            return res.json({
                success: true,
                bot: { ready: Boolean(c?.isReady?.()), ping: safePing(c), guildsCount: globalGuildCount, membersCount: globalMembers, commandsCount: commandCount, uptimeSeconds: Math.floor(process.uptime()) },
                servers: 0, guilds: 0, members: 0, commands: commandCount, ping: safePing(c),
                database: { totalUsers: await User_1.User.countDocuments() }, user: null,
                uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString()
            });
        }
        const [userDoc, aiRequests, aiErrors, aiSessionStats] = await Promise.all([
            User_1.User.findOne({ discordId: payload.discordId }).select('guilds isPremium email username globalName').lean(),
            AiLog_1.default.countDocuments({ userId: payload.discordId }),
            AiLog_1.default.countDocuments({ userId: payload.discordId, status: 'error' }),
            AiSession_1.default.aggregate([{ $match: { userId: payload.discordId } }, { $group: { _id: null, requests: { $sum: '$totalRequests' }, tokens: { $sum: '$totalTokens' } } }])
        ]);
        const ids = accessibleGuildIds(userDoc);
        const live = liveGuilds(ids);
        const members = live.reduce((n, g) => n + Number(g?.memberCount || 0), 0);
        const perGuild = ids.map(id => {
            const source = (userDoc?.guilds || []).find((g) => String(g.id) === id);
            const lg = c?.guilds?.cache?.get?.(id);
            return { id, name: lg?.name || source?.name || 'Serveur Discord', memberCount: Number(lg?.memberCount ?? source?.memberCount ?? 0) };
        });
        const recentAi = await AiLog_1.default.aggregate([
            { $match: { userId: payload.discordId, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, requests: { $sum: 1 }, errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } }, tokens: { $sum: '$totalTokens' } } },
            { $sort: { _id: 1 } }
        ]);
        const recentActivity = await PlatformEvent_1.default.find({
            $or: [{ userId: payload.discordId }, { guildId: { $in: ids } }],
            createdAt: { $gte: new Date(Date.now() - 30 * 86400000) }
        }).sort({ createdAt: -1 }).limit(100).lean();
        return res.json({
            success: true,
            bot: { ready: Boolean(c?.isReady?.()), ping: safePing(c), guildsCount: globalGuildCount, membersCount: globalMembers, commandsCount: commandCount, uptimeSeconds: Math.floor(process.uptime()) },
            servers: ids.length,
            guilds: ids.length,
            members,
            commands: commandCount,
            ping: safePing(c),
            database: { totalUsers: await User_1.User.countDocuments() },
            user: {
                discordId: payload.discordId,
                username: userDoc?.globalName || userDoc?.username || payload.username,
                guildsCount: ids.length,
                isPremium: Boolean(userDoc?.isPremium),
                plan: userDoc?.isPremium ? 'premium' : 'free',
                aiRequests: Number(aiSessionStats?.[0]?.requests ?? aiRequests),
                aiErrors,
                guilds: perGuild,
                aiActivity: recentAi.map((x) => ({ date: x._id, requests: Number(x.requests || 0), errors: Number(x.errors || 0), tokens: Number(x.tokens || 0) })),
                activity: recentActivity
            },
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[STATS] /stats', error);
        return res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
    }
});
router.get('/stats/timeline', async (req, res) => {
    try {
        const { start, end } = range(req);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
            return res.status(400).json({ success: false, error: 'Période invalide.' });
        const payload = currentUser(req);
        const userFilter = payload?.discordId ? { userId: payload.discordId } : {};
        const [users, guilds, ai] = await Promise.all([
            User_1.User.aggregate([{ $match: { createdAt: { $gte: start, $lte: end } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
            PlatformEvent_1.default.aggregate([{ $match: { type: 'guild_added', ...userFilter, createdAt: { $gte: start, $lte: end } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
            AiLog_1.default.aggregate([{ $match: { ...userFilter, createdAt: { $gte: start, $lte: end } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, requests: { $sum: 1 }, errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } }, tokens: { $sum: '$totalTokens' } } }, { $sort: { _id: 1 } }])
        ]);
        return res.json({ success: true, period: { start, end }, users: users.map((x) => ({ date: x._id, count: Number(x.count || 0) })), guilds: guilds.map((x) => ({ date: x._id, count: Number(x.count || 0) })), ai: ai.map((x) => ({ date: x._id, requests: Number(x.requests || 0), errors: Number(x.errors || 0), tokens: Number(x.tokens || 0) })) });
    }
    catch (e) {
        return res.status(500).json({ success: false, error: 'Impossible de charger la timeline.' });
    }
});
router.get('/stats/health', async (_req, res) => {
    const c = client();
    const discord = Boolean(c?.isReady?.());
    const mongo = await User_1.User.exists({}).then(() => true).catch(() => false);
    return res.status(discord && mongo ? 200 : 503).json({ success: discord && mongo, service: 'OMNIX', status: discord && mongo ? 'online' : 'degraded', discord: discord ? 'connected' : 'disconnected', database: mongo ? 'connected' : 'unavailable', timestamp: new Date().toISOString() });
});
exports.default = router;
