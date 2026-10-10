"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ModerationCase_1 = __importDefault(require("../../../models/ModerationCase"));
const actionEmoji = {
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
        .setName('history')
        .setDescription('Affiche l’historique de modération d’un membre')
        .addUserOption(option => option
        .setName('membre')
        .setDescription('Membre à consulter')
        .setRequired(true)),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const user = interaction.options.getUser('membre', true);
        const cases = await ModerationCase_1.default.find({
            guildId: guild.id,
            userId: user.id,
        })
            .sort({ createdAt: -1 })
            .limit(25)
            .lean();
        if (!cases.length) {
            return interaction.reply({
                content: `📭 Aucun historique de modération pour **${user.tag}** sur ce serveur.`,
                ephemeral: true,
            });
        }
        const description = cases
            .map(item => {
            const emoji = actionEmoji[item.action] ?? '🛡️';
            const timestamp = Math.floor(new Date(item.createdAt).getTime() / 1000);
            return (`${emoji} **Case #${item.caseNumber} — ${item.action.toUpperCase()}**\n` +
                `📝 ${item.reason}\n` +
                `👮 <@${item.moderatorId}> • <t:${timestamp}:R>\n`);
        })
            .join('\n');
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`📜 Historique — ${user.tag}`)
            .setThumbnail(user.displayAvatarURL({
            size: 512,
        }))
            .setDescription(description)
            .addFields({
            name: '📊 Cases affichées',
            value: `${cases.length}`,
            inline: true,
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
