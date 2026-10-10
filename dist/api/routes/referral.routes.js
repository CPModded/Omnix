"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const Referral_1 = __importDefault(require("../../models/Referral"));
const License_1 = require("../../models/License");
const auth_routes_1 = require("./auth.routes");
const client_1 = require("../../bot/client");
const router = express_1.default.Router();
const REFERRAL_COOKIE = 'omnix_referral';
const DEFAULT_INVITE = 'https://discord.gg/rmes9YdgG9';
function currentUser(req) {
    const token = (0, auth_routes_1.getRequestToken)(req);
    if (!token)
        return null;
    const payload = (0, auth_routes_1.verifyJwt)(token);
    const discordId = String(payload?.discordId || '').trim();
    return discordId ? { discordId } : null;
}
function inviteUrl() {
    return String(process.env.OMNIX_REFERRAL_INVITE_URL || DEFAULT_INVITE).trim();
}
function referralCode() {
    return node_crypto_1.default.randomBytes(5).toString('base64url').toUpperCase();
}
async function ensureCode(referrerId) {
    const existing = await Referral_1.default.findOne({ referrerId, referredId: null, status: 'pending' }).sort({ createdAt: -1 }).lean();
    if (existing?.code)
        return existing.code;
    for (let i = 0; i < 5; i++) {
        const code = referralCode();
        try {
            await Referral_1.default.create({ code, referrerId, status: 'pending', rewardDays: 7 });
            return code;
        }
        catch (e) {
            if (e?.code !== 11000)
                throw e;
        }
    }
    throw new Error('Impossible de générer le lien de parrainage.');
}
router.get('/go/:code', async (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const referral = await Referral_1.default.findOne({ code, status: 'pending', referredId: null }).lean();
    if (!referral)
        return res.redirect(inviteUrl());
    res.cookie(REFERRAL_COOKIE, code, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
    return res.redirect(inviteUrl());
});
async function requireAuth(req, res, next) {
    const user = currentUser(req);
    if (!user)
        return res.status(401).json({ success: false, error: 'Authentification requise.', code: 'AUTH_REQUIRED' });
    req.referralUser = user;
    next();
}
router.get('/me', requireAuth, async (req, res) => {
    const userId = req.referralUser.discordId;
    const [owned, received] = await Promise.all([
        Referral_1.default.find({ referrerId: userId }).sort({ createdAt: -1 }).limit(100).lean(),
        Referral_1.default.findOne({ referredId: userId, status: 'validated' }).lean(),
    ]);
    const validated = owned.filter((x) => x.status === 'validated').length;
    return res.json({ success: true, data: { code: await ensureCode(userId), inviteUrl: inviteUrl(), total: owned.length, validated, rewardedDays: owned.filter((x) => x.rewardGranted).reduce((n, x) => n + Number(x.rewardDays || 0), 0), received: Boolean(received) } });
});
router.post('/claim', requireAuth, async (req, res) => {
    const userId = req.referralUser.discordId;
    const code = String(req.body?.code || req.cookies?.[REFERRAL_COOKIE] || '').trim().toUpperCase();
    if (!code)
        return res.status(400).json({ success: false, error: 'Lien de parrainage introuvable.' });
    const referral = await Referral_1.default.findOne({ code, status: 'pending', referredId: null });
    if (!referral)
        return res.status(404).json({ success: false, error: 'Parrainage introuvable ou déjà utilisé.' });
    if (referral.referrerId === userId)
        return res.status(400).json({ success: false, error: 'Vous ne pouvez pas vous parrainer vous-même.' });
    if (await Referral_1.default.exists({ referredId: userId, status: { $in: ['pending', 'validated'] } }))
        return res.status(409).json({ success: false, error: 'Ce compte a déjà été associé à un parrainage.' });
    const recentReward = await Referral_1.default.findOne({ referrerId: referral.referrerId, rewardGranted: true, rewardedAt: { $gt: new Date(Date.now() - 7 * 86400000) } }).lean();
    if (recentReward)
        return res.status(429).json({ success: false, code: 'REFERRAL_REWARD_COOLDOWN', error: 'La prochaine récompense Premium sera disponible après 7 jours.' });
    const guildId = String(process.env.OMNIX_REFERRAL_GUILD_ID || process.env.OMNIX_PREMIUM_GUILD_ID || '').trim();
    let isMember = false;
    if (guildId) {
        try {
            const guild = client_1.client?.guilds?.cache?.get(guildId) || await client_1.client?.guilds?.fetch?.(guildId);
            if (guild?.members?.fetch) {
                await guild.members.fetch(userId);
                isMember = true;
            }
        }
        catch {
            isMember = false;
        }
    }
    if (!isMember)
        return res.status(409).json({ success: false, code: 'REFERRAL_NOT_VERIFIED', error: 'Votre présence sur le serveur officiel n’a pas encore pu être vérifiée. Configure OMNIX_REFERRAL_GUILD_ID avec l’ID du serveur officiel.' });
    referral.referredId = userId;
    referral.status = 'validated';
    referral.joinedAt = new Date();
    referral.validatedAt = new Date();
    referral.rewardGranted = true;
    referral.rewardedAt = new Date();
    await referral.save();
    const now = new Date();
    const existing = await License_1.License.find({ buyerId: referral.referrerId, status: 'active', tier: 'premium', $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }).sort({ expiresAt: -1 }).limit(1);
    const currentExpiry = existing[0]?.expiresAt && existing[0].expiresAt > now ? existing[0].expiresAt : now;
    const expiresAt = new Date(currentExpiry.getTime() + referral.rewardDays * 86400000);
    await License_1.License.create({ key: `OMNIX-REF-${node_crypto_1.default.randomBytes(8).toString('hex').toUpperCase()}`, tier: 'premium', status: 'active', buyerId: referral.referrerId, activatedGuildId: null, activatedAt: null, expiresAt, durationInDays: referral.rewardDays, maxGuilds: 10, activatedGuildIds: [] });
    res.clearCookie(REFERRAL_COOKIE, { path: '/' });
    return res.json({ success: true, rewardDays: referral.rewardDays, expiresAt });
});
exports.default = router;
