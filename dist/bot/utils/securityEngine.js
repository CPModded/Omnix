"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSecurityMessage = processSecurityMessage;
exports.clearSecurityCaches = clearSecurityCaches;
const discord_js_1 = require("discord.js");
const GuildConfig_1 = __importDefault(require("../../models/GuildConfig"));
const platformEvents_1 = require("../../services/platformEvents");
const spamWindows = new Map();
const repeatWindows = new Map();
function isStaff(member) {
    return Boolean(member?.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild) || member?.permissions.has(discord_js_1.PermissionFlagsBits.ManageMessages));
}
function hasUrl(content) { return /https?:\/\/|www\./i.test(content); }
function hasDiscordInvite(content) { return /(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/i.test(content); }
function capsPercentage(content) {
    const letters = [...content].filter(c => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(c));
    if (!letters.length)
        return 0;
    const caps = letters.filter(c => c === c.toUpperCase() && c !== c.toLowerCase()).length;
    return Math.round((caps / letters.length) * 100);
}
function countMentions(message) { return message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0); }
function hasMedia(message) { return message.attachments.size > 0 || message.embeds.some(e => Boolean(e.url)); }
function isGif(message) { return message.embeds.some(e => /gif/i.test(String(e.url || e.provider?.name || '')) || /gif/i.test(String(e.image?.url || ''))); }
async function punish(message, action, reason, duration = 60_000, deleteMessage = true) {
    const member = message.member;
    try {
        if (deleteMessage && message.deletable && action !== 'none')
            await message.delete().catch(() => null);
        if (!member || isStaff(member))
            return true;
        if (action === 'mute' || action === 'timeout')
            await member.timeout(duration, `OMNIX AutoMod: ${reason}`).catch(() => null);
        else if (action === 'kick' && member.kickable)
            await member.kick(`OMNIX AutoMod: ${reason}`).catch(() => null);
        else if (action === 'ban' && member.bannable)
            await member.ban({ reason: `OMNIX AutoMod: ${reason}` }).catch(() => null);
        return true;
    }
    catch {
        return false;
    }
}
async function processSecurityMessage(message) {
    if (!message.guild || message.author.bot || !message.member)
        return false;
    const config = await GuildConfig_1.default.findOne({ guildId: message.guild.id }).lean();
    const antiSpam = config?.modules?.antiSpam;
    const antiLink = config?.modules?.antiLink;
    const autoMod = config?.modules?.autoMod;
    const honeypot = config?.modules?.honeypot;
    const now = Date.now();
    // Honeypot is a dedicated trap channel: any non-bot/non-staff message is removed
    // and the author is banned. This runs before the regular moderation rules.
    if (honeypot?.enabled && honeypot?.channelId === message.channel.id) {
        if (isStaff(message.member))
            return true;
        if (message.deletable)
            await message.delete().catch(() => null);
        let banned = false;
        if (message.member?.bannable) {
            banned = await message.member.ban({ reason: 'OMNIX Honeypot: message envoyé dans le salon piège' })
                .then(() => true)
                .catch((error) => { console.error('[Honeypot] Ban impossible:', error); return false; });
        }
        else {
            console.warn('[Honeypot] Membre non bannissable:', message.author.id);
        }
        await (0, platformEvents_1.recordPlatformEvent)('automod_triggered', {
            userId: message.author.id,
            guildId: message.guild.id,
            metadata: { rule: 'honeypot', channelId: message.channel.id, action: banned ? 'ban' : 'delete' },
        });
        return true;
    }
    const key = `${message.guild.id}:${message.author.id}`;
    if (antiSpam?.enabled) {
        const windowMs = Math.max(1000, Number(antiSpam.timeWindow || 5000));
        const max = Math.max(1, Number(antiSpam.maxMessages || 5));
        const arr = (spamWindows.get(key) || []).filter(t => now - t < windowMs);
        arr.push(now);
        spamWindows.set(key, arr);
        if (arr.length > max) {
            await punish(message, 'mute', 'anti-spam', Number(antiSpam.muteDuration || 60000));
            await (0, platformEvents_1.recordPlatformEvent)('automod_triggered', { userId: message.author.id, guildId: message.guild.id, metadata: { rule: 'antiSpam', count: arr.length } });
            return true;
        }
    }
    const content = message.content || '';
    if (antiLink?.enabled && hasUrl(content)) {
        const whitelist = Array.isArray(antiLink.whitelist) ? antiLink.whitelist.map((x) => String(x).toLowerCase()) : [];
        const allowed = whitelist.some((domain) => content.toLowerCase().includes(domain));
        if (!allowed) {
            await punish(message, String(antiLink.action || 'delete'), 'lien non autorisé');
            await (0, platformEvents_1.recordPlatformEvent)('automod_triggered', { userId: message.author.id, guildId: message.guild.id, metadata: { rule: 'antiLink' } });
            return true;
        }
    }
    if (autoMod?.enabled) {
        const words = Array.isArray(autoMod.badWords) ? autoMod.badWords.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
        const lower = content.toLowerCase();
        if (words.some((word) => lower.includes(word))) {
            await punish(message, 'delete', 'mot interdit', 60_000, autoMod.deleteMessages !== false);
            await (0, platformEvents_1.recordPlatformEvent)('automod_triggered', { userId: message.author.id, guildId: message.guild.id, metadata: { rule: 'badWords' } });
            return true;
        }
        if (countMentions(message) > Number(autoMod.maxMentions || 5)) {
            await punish(message, 'delete', 'mentions excessives', 60_000, autoMod.deleteMessages !== false);
            await (0, platformEvents_1.recordPlatformEvent)('automod_triggered', { userId: message.author.id, guildId: message.guild.id, metadata: { rule: 'mentions' } });
            return true;
        }
        if (capsPercentage(content) >= Number(autoMod.maxCapsPercentage || 80) && content.length >= 8) {
            await punish(message, 'delete', 'majuscules excessives', 60_000, autoMod.deleteMessages !== false);
            await (0, platformEvents_1.recordPlatformEvent)('automod_triggered', { userId: message.author.id, guildId: message.guild.id, metadata: { rule: 'caps' } });
            return true;
        }
        if (autoMod.antiInvites !== false && hasDiscordInvite(content)) {
            await punish(message, 'delete', 'invitation Discord non autorisée', 60_000, autoMod.deleteMessages !== false);
            await (0, platformEvents_1.recordPlatformEvent)('automod_triggered', { userId: message.author.id, guildId: message.guild.id, metadata: { rule: 'discordInvite' } });
            return true;
        }
        if (autoMod.antiMedia === true && hasMedia(message)) {
            await punish(message, 'delete', 'média non autorisé', 60_000, autoMod.deleteMessages !== false);
            return true;
        }
        if (autoMod.antiFiles === true && message.attachments.size > 0) {
            await punish(message, 'delete', 'fichier non autorisé', 60_000, autoMod.deleteMessages !== false);
            return true;
        }
        if (autoMod.antiGif === true && isGif(message)) {
            await punish(message, 'delete', 'GIF non autorisé', 60_000, autoMod.deleteMessages !== false);
            return true;
        }
    }
    const repeatKey = `${message.guild.id}:${message.channel.id}:${message.author.id}`;
    const normalized = content.trim().toLowerCase().slice(0, 500);
    if (autoMod?.antiRepeat === true && normalized) {
        const arr = (repeatWindows.get(repeatKey) || []).slice(-4);
        arr.push(normalized);
        repeatWindows.set(repeatKey, arr);
        if (arr.length >= 3 && arr.every(x => x === normalized)) {
            await punish(message, 'delete', 'répétition excessive', 60_000, autoMod.deleteMessages !== false);
            repeatWindows.delete(repeatKey);
            return true;
        }
    }
    return false;
}
function clearSecurityCaches() { spamWindows.clear(); repeatWindows.clear(); }
