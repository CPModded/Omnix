"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const guildConfig_1 = require("../utils/guildConfig");
exports.default = { data: new discord_js_1.SlashCommandBuilder().setName('autorole').setDescription('Configure le rôle automatique').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles).addSubcommand(s => s.setName('set').setDescription('Définit le rôle').addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true))).addSubcommand(s => s.setName('disable').setDescription('Désactive')), async execute(i) { const cfg = await (0, guildConfig_1.getGuildConfig)(i.guild.id); const a = cfg.modules.autoRole; if (i.options.getSubcommand() === 'disable') {
        await (0, guildConfig_1.updateGuildConfig)(i.guild.id, { modules: { autoRole: { ...a, enabled: false } } });
        return i.reply({ content: '✅ Auto-role désactivé.', flags: discord_js_1.MessageFlags.Ephemeral });
    } const role = i.options.getRole('role', true); if (role.managed)
        return i.reply({ content: '❌ Ce rôle est géré par Discord.', flags: discord_js_1.MessageFlags.Ephemeral }); await (0, guildConfig_1.updateGuildConfig)(i.guild.id, { modules: { autoRole: { ...a, enabled: true, roleId: role.id } } }); return i.reply({ content: `✅ Auto-role : ${role}`, flags: discord_js_1.MessageFlags.Ephemeral }); } };
