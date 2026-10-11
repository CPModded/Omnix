"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = { data: new discord_js_1.SlashCommandBuilder().setName('bot-name').setDescription('Change le surnom d’Omnix sur ce serveur').addStringOption(o => o.setName('nom').setDescription('Nouveau surnom').setRequired(true).setMaxLength(32)).setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild), async execute(i) { const name = i.options.getString('nom', true).trim(); const me = i.guild?.members.me; if (!me)
        return i.reply({ content: '❌ Omnix n’est pas encore prêt.', flags: discord_js_1.MessageFlags.Ephemeral }); if (!me.manageable)
        return i.reply({ content: '❌ Le rôle d’Omnix est trop bas pour modifier son surnom.', flags: discord_js_1.MessageFlags.Ephemeral }); await me.setNickname(name, { reason: `OMNIX /bot-name par ${i.user.tag}` }); return i.reply({ content: `✅ Mon surnom sur **${i.guild.name}** est maintenant **${name}**.`, flags: discord_js_1.MessageFlags.Ephemeral }); } };
