"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const license_controller_1 = require("../controllers/license.controller");
const auth_1 = require("../middlewares/auth");
const guildAuth_1 = require("../middlewares/guildAuth");
const License_1 = __importDefault(require("../../models/License"));
const router = (0, express_1.Router)();
router.get('/me', auth_1.isAuthenticated, async (req, res) => {
    try {
        const guildId = String(req.query.guildId || '').trim();
        const now = new Date();
        const q = { buyerId: String(req.user.discordId), status: { $in: ['active', 'used'] }, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] };
        if (/^\d{17,20}$/.test(guildId))
            q.$and = [{ $or: [{ activatedGuildId: guildId }, { activatedGuildIds: guildId }] }];
        const license = await License_1.default.findOne(q).sort({ createdAt: -1 }).lean();
        const activatedGuildIds = license ? Array.from(new Set([...(Array.isArray(license.activatedGuildIds) ? license.activatedGuildIds.map(String) : []), ...(license.activatedGuildId ? [String(license.activatedGuildId)] : [])])) : [];
        const guildActive = Boolean(license && (!guildId || activatedGuildIds.includes(guildId)));
        return res.json({ success: true, activeForGuild: guildActive, license: license ? { key: license.key, tier: license.tier, status: license.status, expiresAt: license.expiresAt, activatedGuildId: license.activatedGuildId, activatedGuildIds, maxGuilds: license.maxGuilds || 10 } : null });
    }
    catch (e) {
        console.error('[Licensing] /me', e);
        return res.status(500).json({ success: false, error: 'Impossible de vérifier la licence.' });
    }
});
router.post('/activate', auth_1.isAuthenticated, guildAuth_1.canManageGuild, license_controller_1.LicenseController.activateLicense);
router.post('/activate-server', auth_1.isAuthenticated, guildAuth_1.canManageGuild, license_controller_1.LicenseController.activatePremiumServer);
exports.default = router;
