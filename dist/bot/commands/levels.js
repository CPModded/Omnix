"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const guildConfig_1 = require("../utils/guildConfig");
exports.default = { data: new discord_js_1.SlashCommandBuilder().setName('levels').setDescription('Configure le système de niveaux').setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild).addSubcommand(s => s.setName('enable').setDescription('Active')).addSubcommand(s => s.setName('disable').setDescription('Désactive')).addSubcommand(s => s.setName('xp').setDescription('XP par message').addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(1).setMaxValue(100))), async execute(i) { const cfg = await (0, guildConfig_1.getGuildConfig)(i.guild.id); const l = cfg.modules.levels; const sub = i.options.getSubcommand(); if (sub === 'enable' || sub === 'disable') {
        const enabled = sub === 'enable';
        await (0, guildConfig_1.updateGuildConfig)(i.guild.id, { modules: { levels: { ...l, enabled } } });
        return i.reply({ content: `✅ Levels ${enabled ? 'activé' : 'désactivé'}.`, flags: discord_js_1.MessageFlags.Ephemeral });
    } const xp = i.options.getInteger('montant', true); await (0, guildConfig_1.updateGuildConfig)(i.guild.id, { modules: { levels: { ...l, xpPerMessage: xp } } }); return i.reply({ content: `✅ XP par message : **${xp}**.`, flags: discord_js_1.MessageFlags.Ephemeral }); } };
