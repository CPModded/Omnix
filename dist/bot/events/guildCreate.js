"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const GuildConfig_1 = __importDefault(require("../../models/GuildConfig"));
const License_1 = require("../../models/License");
const platformEvents_1 = require("../../services/platformEvents");
exports.default = { name: discord_js_1.Events.GuildCreate, once: false, async execute(guild) {
        const guildId = guild.id, ownerId = guild.ownerId;
        try {
            let config = await GuildConfig_1.default.findOne({ guildId });
            if (!config)
                config = new GuildConfig_1.default({ guildId });
            config.name = guild.name;
            config.ownerId = ownerId;
            config.icon = guild.iconURL({ extension: 'png', size: 128 }) || null;
            const now = new Date();
            const license = await License_1.License.findOneAndUpdate({ buyerId: ownerId, status: 'active', activatedGuildId: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }, { $set: { status: 'used', activatedGuildId: guildId, activatedAt: now } }, { new: true });
            if (license) {
                const expiresAt = license.durationInDays > 0 ? new Date(now.getTime() + license.durationInDays * 86400000) : null;
                license.expiresAt = expiresAt;
                await license.save();
                config.premium.isPremium = true;
                config.premium.tier = license.tier;
                config.premium.expiresAt = expiresAt;
            }
            await config.save();
            await (0, platformEvents_1.recordPlatformEvent)('guild_added', { guildId, userId: ownerId, metadata: { name: guild.name, memberCount: guild.memberCount } });
            console.log(`[Bot Sync] ✓ Configuration synchronisée pour ${guild.name} (${guildId})`);
        }
        catch (e) {
            console.error(`[Bot Sync] Erreur ${guild.name}:`, e);
        }
    } };
