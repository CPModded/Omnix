"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const GuildConfig_1 = __importDefault(require("../../models/GuildConfig"));
const platformEvents_1 = require("../../services/platformEvents");
function render(template, member) {
    return String(template || '')
        .replaceAll('{user}', member.user.username)
        .replaceAll('{username}', member.user.username)
        .replaceAll('{displayname}', member.displayName)
        .replaceAll('{userid}', member.id)
        .replaceAll('{server}', member.guild.name)
        .replaceAll('{serverid}', member.guild.id)
        .replaceAll('{membercount}', String(member.guild.memberCount || 0))
        .replaceAll('{mention}', `<@${member.id}>`);
}
function safeColor(value) {
    const raw = String(value || '#7c5cff').trim().replace(/^#/, '');
    return /^[0-9a-fA-F]{6}$/.test(raw) ? Number.parseInt(raw, 16) : 0x7c5cff;
}
exports.default = {
    name: discord_js_1.Events.GuildMemberRemove,
    async execute(member) {
        try {
            await (0, platformEvents_1.recordPlatformEvent)('member_left', { userId: member.id, guildId: member.guild.id, metadata: { username: member.user.username } });
            const config = await GuildConfig_1.default.findOne({ guildId: member.guild.id });
            const goodbye = config?.modules?.goodbye;
            if (!goodbye?.enabled || !goodbye.channelId)
                return;
            const channel = member.guild.channels.cache.get(goodbye.channelId);
            if (!channel?.isTextBased?.())
                return;
            const content = render(goodbye.message || '{user} a quitté le serveur.', member);
            const mention = goodbye.mentionUser !== false ? `<@${member.id}>` : '';
            if (goodbye.embed !== false) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(render(goodbye.title || 'À bientôt !', member))
                    .setDescription(content)
                    .setColor(safeColor(goodbye.color));
                if (goodbye.thumbnail !== false)
                    embed.setThumbnail(member.user.displayAvatarURL({ size: 128 }));
                if (goodbye.imageUrl)
                    embed.setImage(render(goodbye.imageUrl, member));
                if (goodbye.footer)
                    embed.setFooter({ text: render(goodbye.footer, member) });
                await channel.send({ content: mention || undefined, embeds: [embed] }).catch(() => null);
            }
            else {
                await channel.send({ content: mention ? `${mention}\n${content}` : content }).catch(() => null);
            }
        }
        catch (e) {
            console.error('[GuildMemberRemove]', e);
        }
    },
};
