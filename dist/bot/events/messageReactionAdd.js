"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const guildConfig_1 = require("../utils/guildConfig");
exports.default = {
    name: discord_js_1.Events.MessageReactionAdd,
    async execute(reaction, user) {
        if (user.bot)
            return;
        if (reaction.partial) {
            try {
                await reaction.fetch();
            }
            catch {
                return;
            }
        }
        try {
            const guildId = reaction.message.guildId;
            if (!guildId)
                return;
            const config = await (0, guildConfig_1.getGuildConfig)(guildId);
            const module = config?.modules?.reactionRoles;
            if (!module?.enabled)
                return;
            const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
            const rule = (module.entries || []).find((entry) => String(entry.messageId) === String(reaction.message.id) &&
                (String(entry.emoji) === String(reaction.emoji.name) || String(entry.emoji) === emoji));
            if (!rule)
                return;
            const member = await reaction.message.guild?.members.fetch(user.id);
            if (!member)
                return;
            if (rule.mode === 'exclusive') {
                await member.roles.remove((module.entries || [])
                    .filter((entry) => String(entry.messageId) === String(rule.messageId) && String(entry.roleId) !== String(rule.roleId))
                    .map((entry) => String(entry.roleId)), 'OMNIX Reaction-Role exclusif').catch(() => null);
            }
            if (member.roles.cache.has(String(rule.roleId))) {
                await member.roles.remove(String(rule.roleId), 'OMNIX Reaction-Role Toggle').catch(() => null);
            }
            else {
                await member.roles.add(String(rule.roleId), 'OMNIX Reaction-Role System').catch(() => null);
            }
        }
        catch (err) {
            console.error('[Reaction Role] Erreur :', err?.message || err);
        }
    },
};
