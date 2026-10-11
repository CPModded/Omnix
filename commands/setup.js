"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const guildConfig_1 = require("../utils/guildConfig");
exports.default = { data: new discord_js_1.SlashCommandBuilder().setName('setup').setDescription('Assistant de configuration rapide OMNIX').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild).addSubcommand(s => s.setName('quick').setDescription('Configure automatiquement les éléments essentiels')).addSubcommand(s => s.setName('check').setDescription('Analyse la configuration du serveur')), async execute(i) { const sub = i.options.getSubcommand(); const cfg = await (0, guildConfig_1.getGuildConfig)(i.guild.id); if (sub === 'check') {
        const me = i.guild.members.me;
        const checks = [['Bot présent', !!me], ['Gérer le serveur', !!me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild)], ['Logs', !!cfg.modules.logs.enabled], ['Welcome', !!cfg.modules.welcome.enabled], ['AutoMod', !!cfg.modules.autoMod.enabled], ['Anti-Raid', !!cfg.modules.antiRaid.enabled], ['Vérification', !!cfg.modules.verification.enabled], ['Tickets', !!cfg.modules.tickets.enabled]];
        const ok = checks.filter(x => x[1]).length;
        const e = new discord_js_1.EmbedBuilder().setTitle('🩺 OMNIX Health Check').setDescription(checks.map(x => `${x[1] ? '🟢' : '⚪'} **${x[0]}**`).join('\n')).addFields({ name: 'Configuration', value: `${ok}/${checks.length} contrôles actifs` }).setColor(0x6366f1);
        return i.reply({ embeds: [e], flags: discord_js_1.MessageFlags.Ephemeral });
    } let log = i.guild.channels.cache.find((c) => c.type === discord_js_1.ChannelType.GuildText && /omnix[-_ ]?logs/i.test(c.name)); if (!log) {
        log = await i.guild.channels.create({ name: 'omnix-logs', type: discord_js_1.ChannelType.GuildText, reason: 'OMNIX Quick Setup' });
    } await (0, guildConfig_1.updateGuildConfig)(i.guild.id, { modules: { logs: { enabled: true, channelIds: { ...cfg.modules.logs.channelIds, bot: log.id, errors: log.id, security: log.id, moderation: log.id } }, statistics: { ...cfg.modules.statistics, enabled: true } } }); return i.reply({ content: `✅ **OMNIX Quick Setup terminé.**\n• Logs : ${log}\n• Configuration MongoDB synchronisée\n• Utilise le Dashboard pour personnaliser les autres modules.`, flags: discord_js_1.MessageFlags.Ephemeral }); } };
