"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const PlatformEvent_1 = __importDefault(require("../../models/PlatformEvent"));
exports.default = { data: new discord_js_1.SlashCommandBuilder().setName('serverstats').setDescription('Statistiques d’activité du serveur'), async execute(i) { const since = new Date(Date.now() - 86400000); const [commands, joins, leaves] = await Promise.all([PlatformEvent_1.default.countDocuments({ guildId: i.guild.id, type: 'command_executed', createdAt: { $gte: since } }), PlatformEvent_1.default.countDocuments({ guildId: i.guild.id, type: 'member_joined', createdAt: { $gte: since } }), PlatformEvent_1.default.countDocuments({ guildId: i.guild.id, type: 'member_left', createdAt: { $gte: since } })]); return i.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('📊 Omnix Analytics • 24h').addFields({ name: 'Membres', value: String(i.guild.memberCount), inline: true }, { name: 'Commandes', value: String(commands), inline: true }, { name: 'Arrivées', value: String(joins), inline: true }, { name: 'Départs', value: String(leaves), inline: true }).setColor(0x06b6d4)] }); } };
