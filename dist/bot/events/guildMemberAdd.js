"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const GuildConfig_1 = __importDefault(require("../../models/GuildConfig"));
const platformEvents_1 = require("../../services/platformEvents");
const WelcomeDispatch_1 = __importDefault(require("../../models/WelcomeDispatch"));
const raidWindows = new Map();
const localWelcomeDispatches = new Set();
function render(template, member) {
    return String(template || '')
        .replaceAll('{user}', `<@${member.id}>`)
        .replaceAll('{username}', member.user.username)
        .replaceAll('{displayname}', member.displayName)
        .replaceAll('{userid}', member.id)
        .replaceAll('{server}', member.guild.name)
        .replaceAll('{serverid}', member.guild.id)
        .replaceAll('{membercount}', String(member.guild.memberCount))
        .replaceAll('{mention}', `<@${member.id}>`);
}
function safeColor(value) {
    const raw = String(value || '#7c5cff').trim().replace(/^#/, '');
    return /^[0-9a-fA-F]{6}$/.test(raw) ? Number.parseInt(raw, 16) : 0x7c5cff;
}
exports.default = {
    name: discord_js_1.Events.GuildMemberAdd,
    async execute(member) {
        try {
            await (0, platformEvents_1.recordPlatformEvent)('member_joined', {
                userId: member.id,
                guildId: member.guild.id,
                metadata: { username: member.user.username, memberCount: member.guild.memberCount },
            });
            const config = await GuildConfig_1.default.findOne({ guildId: member.guild.id });
            if (config?.modules?.antiRaid?.enabled) {
                const rule = config.modules.antiRaid;
                const now = Date.now();
                const key = member.guild.id;
                const windowMs = Math.max(1000, Number(rule.timeWindow || 10000));
                const threshold = Math.max(1, Number(rule.threshold || 10));
                const joins = (raidWindows.get(key) || []).filter(t => now - t < windowMs);
                joins.push(now);
                raidWindows.set(key, joins);
                if (joins.length >= threshold) {
                    const action = String(rule.action || 'kick');
                    if (action === 'ban' && member.bannable)
                        await member.ban({ reason: 'OMNIX Anti-Raid' }).catch(() => null);
                    else if (action === 'kick' && member.kickable)
                        await member.kick('OMNIX Anti-Raid').catch(() => null);
                    await (0, platformEvents_1.recordPlatformEvent)('anti_raid_triggered', { userId: member.id, guildId: member.guild.id, metadata: { threshold, joins: joins.length, action } });
                }
            }
            const auto = config?.modules?.autoRole;
            if (auto?.enabled && auto.roleId && (!auto.humanOnly || !member.user.bot)) {
                const role = member.guild.roles.cache.get(auto.roleId);
                if (role && role.position < (member.guild.members.me?.roles.highest.position || 0)) {
                    await member.roles.add(role, 'OMNIX Auto-Role System').catch(() => null);
                }
            }
            const welcome = config?.modules?.welcome;
            if (welcome?.enabled && welcome.channelId) {
                // Verrou distribué MongoDB : deux instances OMNIX ne peuvent pas
                // envoyer le même Welcomer pour la même arrivée.
                const welcomeKey = `${member.guild.id}:${member.id}`;
                if (localWelcomeDispatches.has(welcomeKey)) {
                    console.warn(`[Welcomer] Doublon local ignoré : ${welcomeKey}`);
                    return;
                }
                localWelcomeDispatches.add(welcomeKey);
                const localExpiry = setTimeout(() => localWelcomeDispatches.delete(welcomeKey), 10 * 60 * 1000);
                localExpiry.unref?.();
                let alreadyDispatched = false;
                try {
                    await WelcomeDispatch_1.default.create({
                        guildId: member.guild.id,
                        memberId: member.id,
                        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                    });
                }
                catch (dispatchError) {
                    if (dispatchError?.code === 11000)
                        alreadyDispatched = true;
                    else {
                        // Mongo indisponible : la barrière locale reste active.
                        console.warn('[Welcomer] Protection distribuée indisponible, verrou local actif.');
                    }
                }
                if (alreadyDispatched) {
                    console.warn(`[Welcomer] Doublon distribué ignoré : ${welcomeKey}`);
                    return;
                }
                const channel = member.guild.channels.cache.get(welcome.channelId);
                if (channel?.isTextBased?.()) {
                    const content = render(welcome.message || 'Bienvenue {user} !', member);
                    const shouldEmbed = welcome.embed !== false;
                    const mention = welcome.mentionUser !== false ? `<@${member.id}>` : '';
                    if (shouldEmbed) {
                        const embed = new discord_js_1.EmbedBuilder()
                            .setColor(safeColor(welcome.color))
                            .setTitle(render(welcome.title || 'Bienvenue sur {server} !', member))
                            .setDescription(content)
                            .setThumbnail(member.user.displayAvatarURL({ size: 128 }));
                        if (welcome.thumbnail === false) { /* avatar volontairement masqué */ }
                        if (welcome.imageUrl)
                            embed.setImage(render(welcome.imageUrl, member));
                        if (welcome.footer)
                            embed.setFooter({ text: render(welcome.footer, member) });
                        await channel.send({
                            content: mention || undefined,
                            embeds: [embed],
                        }).catch(() => null);
                    }
                    else {
                        await channel.send({ content: mention ? `${mention}\n${content}` : content }).catch(() => null);
                    }
                }
            }
        }
        catch (err) {
            console.error('[GuildMemberAdd]', err);
        }
    },
};
