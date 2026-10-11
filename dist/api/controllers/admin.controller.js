"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const guilds_controller_1 = require("./guilds.controller");
const GuildConfig_1 = require("../../models/GuildConfig");
const License_1 = require("../../models/License");
const User_1 = require("../../models/User");
const client_1 = require("../../bot/client");
const systemMonitor_1 = require("../../utils/systemMonitor");
const node_crypto_1 = __importDefault(require("node:crypto"));
class AdminController {
    static async getMonitoring(_req, res) { try {
        return res.json(await systemMonitor_1.SystemMonitor.getStats());
    }
    catch {
        return res.status(500).json({ error: 'Échec de la collecte des métriques.' });
    } }
    static async togglePremium(req, res) { try {
        const { guildId, isPremium, tier, durationInDays } = req.body || {};
        if (guildId === 'USER_LICENSE') {
            const userId = String(req.body?.userId || req.user?.discordId || '');
            const user = await User_1.User.findOne({ discordId: userId });
            if (!user)
                return res.status(404).json({ error: 'Utilisateur introuvable.' });
            await License_1.License.updateMany({ buyerId: userId, status: 'active' }, { $set: { status: 'suspended' } });
            if (isPremium) {
                const days = Number(durationInDays);
                const expiresAt = days > 0 ? new Date(Date.now() + days * 86400000) : null;
                await License_1.License.create({ key: `OMNIX-USER-${node_crypto_1.default.randomBytes(10).toString('hex').toUpperCase()}`, tier: days === 0 ? 'lifetime' : 'premium', status: 'active', buyerId: userId, activatedGuildId: null, activatedAt: null, expiresAt, durationInDays: days, maxGuilds: 10, activatedGuildIds: [] });
                user.isPremium = true;
            }
            else
                user.isPremium = false;
            await user.save();
            return res.json({ message: 'Licence utilisateur mise à jour.', user });
        }
        const id = String(guildId || '');
        if (!/^\d{17,20}$/.test(id))
            return res.status(400).json({ error: 'Guild ID invalide.' });
        const days = Number(durationInDays);
        const expiresAt = isPremium && days > 0 ? new Date(Date.now() + days * 86400000) : null;
        const nextTier = isPremium ? (days === 0 ? 'lifetime' : tier || 'premium') : 'free';
        const config = await GuildConfig_1.GuildConfig.findOneAndUpdate({ guildId: id }, { $set: { plan: nextTier, 'premium.isPremium': Boolean(isPremium), 'premium.tier': nextTier, 'premium.expiresAt': expiresAt, premiumExpiresAt: expiresAt }, $setOnInsert: { guildId: id } }, { new: true, upsert: true, runValidators: true });
        const affectedUsers = String(config?.ownerId || '').trim();
        if (affectedUsers)
            (0, guilds_controller_1.invalidateUserGuildsCache)(affectedUsers);
        else
            (0, guilds_controller_1.invalidateAllUserGuildsCache)();
        return res.json({ message: `Statut premium du serveur ${id} mis à jour.`, config });
    }
    catch (e) {
        console.error('[Admin API] togglePremium', e);
        return res.status(500).json({ error: 'Impossible de modifier le statut.' });
    } }
    static async sendGlobalAnnouncement(req, res) { const message = String(req.body?.messageContent || '').trim().slice(0, 2000); if (!message)
        return res.status(400).json({ error: 'Le contenu du message est requis.' }); let count = 0; for (const guild of client_1.client.guilds.cache.values()) {
        const ch = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased() && guild.members.me && c.permissionsFor(guild.members.me)?.has('SendMessages'));
        if (ch && 'send' in ch) {
            await ch.send({ content: `📢 **Annonce Globale OMNIX**\n\n${message}` }).catch(() => null);
            count++;
        }
    } return res.json({ message: `Annonce envoyée avec succès sur ${count} serveur(s).` }); }
    static async getUsers(_req, res) { try {
        return res.json(await User_1.User.find({}).select('-accessToken -refreshToken -tokenExpiresAt').sort({ createdAt: -1 }).lean());
    }
    catch {
        return res.status(500).json({ error: 'Impossible de récupérer la liste.' });
    } }
    static async toggleBlacklist(req, res) { const id = String(req.body?.userId || ''); const flag = Boolean(req.body?.isBlacklisted); const user = await User_1.User.findOne({ discordId: id }); if (!user)
        return res.status(404).json({ error: 'Utilisateur introuvable.' }); if (user.isAdmin && flag)
        return res.status(400).json({ error: 'Impossible de bannir un membre du staff.' }); user.isBlacklisted = flag; await user.save(); return res.json({ message: 'Statut de bannissement mis à jour.', user }); }
}
exports.AdminController = AdminController;
