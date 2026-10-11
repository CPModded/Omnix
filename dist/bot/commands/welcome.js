"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const guildConfig_1 = require("../utils/guildConfig");
exports.default = { data: new discord_js_1.SlashCommandBuilder().setName('welcome').setDescription('Configure le message de bienvenue').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild).addSubcommand(s => s.setName('enable').setDescription('Active le module').addChannelOption(o => o.setName('salon').setDescription('Salon').addChannelTypes(discord_js_1.ChannelType.GuildText).setRequired(true))).addSubcommand(s => s.setName('disable').setDescription('Désactive le module')).addSubcommand(s => s.setName('message').setDescription('Définit le texte').addStringOption(o => o.setName('texte').setDescription('Message avec variables').setRequired(true).setMaxLength(1800))), async execute(i) { const cfg = await (0, guildConfig_1.getGuildConfig)(i.guild.id); const w = cfg.modules.welcome; const sub = i.options.getSubcommand(); if (sub === 'enable') {
        const c = i.options.getChannel('salon', true);
        await (0, guildConfig_1.updateGuildConfig)(i.guild.id, { modules: { welcome: { ...w, enabled: true, channelId: c.id } } });
        return i.reply({ content: `✅ Bienvenue activé dans ${c}.`, flags: discord_js_1.MessageFlags.Ephemeral });
    } if (sub === 'disable') {
        await (0, guildConfig_1.updateGuildConfig)(i.guild.id, { modules: { welcome: { ...w, enabled: false } } });
        return i.reply({ content: '✅ Bienvenue désactivé.', flags: discord_js_1.MessageFlags.Ephemeral });
    } const message = i.options.getString('texte', true); await (0, guildConfig_1.updateGuildConfig)(i.guild.id, { modules: { welcome: { ...w, message } } }); return i.reply({ content: '✅ Message de bienvenue mis à jour.', flags: discord_js_1.MessageFlags.Ephemeral }); } };
