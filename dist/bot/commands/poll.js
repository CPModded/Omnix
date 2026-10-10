"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = { data: new discord_js_1.SlashCommandBuilder().setName('poll').setDescription('Crée un sondage simple').addStringOption(o => o.setName('question').setDescription('Question').setRequired(true).setMaxLength(1800)), async execute(i) { const q = i.options.getString('question', true); const msg = await i.channel.send(`📊 **Sondage**\n${q}\n\n👍 Oui  •  👎 Non`); await msg.react('👍'); await msg.react('👎'); return i.reply({ content: '✅ Sondage créé.', flags: discord_js_1.MessageFlags.Ephemeral }); } };
