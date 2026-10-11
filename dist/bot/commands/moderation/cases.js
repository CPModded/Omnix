"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ModerationCase_1 = __importDefault(require("../../../models/ModerationCase"));
const emoji = {
    warn: '⚠️',
    mute: '🔇',
    timeout: '⏳',
    kick: '👢',
    ban: '🔨',
    unban: '🔓',
    unmute: '🔊',
    unwarn: '↩️',
    softban: '🧹',
};
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('cases')
        .setDescription('Affiche les dernières cases du serveur')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers)
        .addIntegerOption(option => option
        .setName('nombre')
        .setDescription('Nombre de cases à afficher')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false)),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const amount = interaction.options.getInteger('nombre') ?? 10;
        const cases = await ModerationCase_1.default.find({
            guildId: guild.id,
        })
            .sort({ caseNumber: -1 })
            .limit(amount)
            .lean();
        if (!cases.length) {
            return interaction.reply({
                content: '📭 Aucune case de modération enregistrée.',
                ephemeral: true,
            });
        }
        const description = cases
            .map(item => {
            const icon = emoji[item.action] ?? '🛡️';
            return (`${icon} **#${item.caseNumber} — ${item.action.toUpperCase()}**\n` +
                `👤 <@${item.userId}> • 👮 <@${item.moderatorId}>\n` +
                `📝 ${item.reason}`);
        })
            .join('\n\n');
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`📋 Cases de ${guild.name}`)
            .setDescription(description)
            .setFooter({
            text: `${cases.length} case(s) affichée(s)`,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
