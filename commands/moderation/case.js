"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ModerationCase_1 = __importDefault(require("../../../models/ModerationCase"));
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('case')
        .setDescription('Consulte une case de modération')
        .addIntegerOption(option => option
        .setName('numero')
        .setDescription('Numéro de la case')
        .setMinValue(1)
        .setRequired(true)),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const number = interaction.options.getInteger('numero', true);
        const moderationCase = await ModerationCase_1.default.findOne({
            guildId: guild.id,
            caseNumber: number,
        }).lean();
        if (!moderationCase) {
            return interaction.reply({
                content: `❌ La Case #${number} n'existe pas sur ce serveur.`,
                ephemeral: true,
            });
        }
        const timestamp = Math.floor(new Date(moderationCase.createdAt).getTime() / 1000);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(moderationCase.active
            ? 0xed4245
            : 0x808080)
            .setTitle(`🛡️ Case #${moderationCase.caseNumber}`)
            .addFields({
            name: '⚔️ Action',
            value: moderationCase.action.toUpperCase(),
            inline: true,
        }, {
            name: '📌 Statut',
            value: moderationCase.active
                ? '🟢 Active'
                : '⚪ Inactive',
            inline: true,
        }, {
            name: '👤 Utilisateur',
            value: `<@${moderationCase.userId}>`,
            inline: true,
        }, {
            name: '👮 Modérateur',
            value: `<@${moderationCase.moderatorId}>`,
            inline: true,
        }, {
            name: '📝 Raison',
            value: moderationCase.reason,
            inline: false,
        }, {
            name: '📅 Date',
            value: `<t:${timestamp}:F>`,
            inline: false,
        })
            .setFooter({
            text: guild.name,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
