"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePremium = requirePremium;
const GuildConfig_1 = require("../../models/GuildConfig");
const User_1 = require("../../models/User");
const License_1 = require("../../models/License");
const auth_routes_1 = require("../routes/auth.routes");
async function requirePremium(req, res, next) {
    try {
        const discordId = req.user?.discordId;
        const guildId = String(req.params.guildId || '').trim();
        if (!discordId)
            return void res.status(401).json({ success: false, error: 'Authentification requise.', code: 'AUTH_REQUIRED' });
        if (!/^\d{17,20}$/.test(guildId))
            return void res.status(400).json({ success: false, error: 'Identifiant de serveur invalide.', code: 'INVALID_GUILD_ID' });
        if ((0, auth_routes_1.isOwner)(discordId))
            return void next();
        const user = await User_1.User.findOne({ discordId }).select('isAdmin').lean();
        if (user?.isAdmin)
            return void next();
        const personal = await License_1.License.findOne({
            buyerId: discordId,
            $or: [
                { status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
                { status: 'used', activatedGuildId: guildId, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
            ],
        }).lean();
        if (personal) {
            await GuildConfig_1.GuildConfig.updateOne({ guildId }, { $set: { plan: personal.tier, 'premium.isPremium': true, 'premium.tier': personal.tier, 'premium.expiresAt': personal.expiresAt ?? null, premiumExpiresAt: personal.expiresAt ?? null }, $setOnInsert: { guildId } }, { upsert: true }).catch(() => undefined);
            return void next();
        }
        const config = await GuildConfig_1.GuildConfig.findOne({ guildId }).lean();
        const premium = config?.premium;
        const expiry = premium?.expiresAt ? new Date(premium.expiresAt) : null;
        const active = Boolean(premium?.isPremium) && (!expiry || expiry.getTime() > Date.now());
        if (!active) {
            if (premium?.isPremium && expiry && expiry.getTime() <= Date.now())
                await GuildConfig_1.GuildConfig.updateOne({ guildId }, { $set: { 'premium.isPremium': false, 'premium.tier': 'free', 'premium.expiresAt': null } }).catch(() => undefined);
            return void res.status(403).json({ success: false, error: 'Fonctionnalité Premium.', code: 'PREMIUM_REQUIRED', message: 'Ce serveur ne possède pas de licence Premium active.' });
        }
        return void next();
    }
    catch (error) {
        console.error('[Premium Check]', error);
        return void res.status(500).json({ success: false, error: 'Erreur lors de la validation du statut Premium.', code: 'PREMIUM_CHECK_ERROR' });
    }
}
exports.default = requirePremium;
