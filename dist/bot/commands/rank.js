"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const MemberProfile_1 = __importDefault(require("../../models/MemberProfile"));
exports.default = { data: new discord_js_1.SlashCommandBuilder().setName('rank').setDescription('Affiche le niveau et XP d’un membre').addUserOption(o => o.setName('membre').setDescription('Membre')), async execute(i) { const u = i.options.getUser('membre') || i.user; const p = await MemberProfile_1.default.findOne({ guildId: i.guild.id, userId: u.id }).lean(); const xp = Number(p?.xp || 0), level = Number(p?.level || 0); const next = Math.max(100, (level + 1) * (level + 1) * 100); return i.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`📈 ${u.username}`).setDescription(`Niveau **${level}**\nXP **${xp}/${next}**\nMessages **${Number(p?.messages || 0)}**`).setThumbnail(u.displayAvatarURL()).setColor(0x6366f1)] }); } };
