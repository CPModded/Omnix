"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ModerationCase_1 = __importDefault(require("../../../models/ModerationCase"));
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('modstats')
        .setDescription('Affiche les statistiques de modération')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const cases = await ModerationCase_1.default.find({
            guildId: guild.id,
        })
            .select('action active')
            .lean();
        const count = (action) => cases.filter(item => item.action === action).length;
        const activeWarnings = cases.filter(item => item.action === 'warn' &&
            item.active).length;
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`📊 Modération — ${guild.name}`)
            .addFields({
            name: '📋 Total des cases',
            value: `${cases.length}`,
            inline: true,
        }, {
            name: '⚠️ Warnings',
            value: `${count('warn')}`,
            inline: true,
        }, {
            name: '🟢 Warnings actifs',
            value: `${activeWarnings}`,
            inline: true,
        }, {
            name: '👢 Kicks',
            value: `${count('kick')}`,
            inline: true,
        }, {
            name: '🔨 Bans',
            value: `${count('ban')}`,
            inline: true,
        }, {
            name: '⏳ Timeouts',
            value: `${count('timeout')}`,
            inline: true,
        }, {
            name: '🔇 Mutes',
            value: `${count('mute')}`,
            inline: true,
        }, {
            name: '🧹 Softbans',
            value: `${count('softban')}`,
            inline: true,
        })
            .setFooter({
            text: `Statistiques propres à ${guild.name}`,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
