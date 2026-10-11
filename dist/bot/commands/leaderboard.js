"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const MemberProfile_1 = __importDefault(require("../../models/MemberProfile"));
exports.default = { data: new discord_js_1.SlashCommandBuilder().setName('leaderboard').setDescription('Classement XP du serveur'), async execute(i) { const rows = await MemberProfile_1.default.find({ guildId: i.guild.id }).sort({ xp: -1 }).limit(10).lean(); const text = rows.length ? rows.map((p, n) => `${n + 1}. <@${p.userId}> — niveau ${p.level} • ${p.xp} XP`).join('\n') : 'Aucun classement pour le moment.'; return i.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('🏆 Classement OMNIX').setDescription(text).setColor(0xf59e0b)] }); } };
