"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const GuildTicket_1 = __importDefault(require("../../models/GuildTicket"));
const ModerationCase_1 = __importDefault(require("../../models/ModerationCase"));
const PlatformEvent_1 = __importDefault(require("../../models/PlatformEvent"));
const OMNIX = 0x7c5cff;
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('brief')
        .setDescription('Prépare un brief staff des dernières 24 heures')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
        if (!interaction.guild)
            return interaction.reply({ content: '❌ Cette commande doit être utilisée dans un serveur.', flags: 64 });
        await interaction.deferReply({ flags: 64 });
        const since = new Date(Date.now() - 86400000);
        const guildId = interaction.guild.id;
        const [joins, leaves, errors, tickets, closedTickets, cases] = await Promise.all([
            PlatformEvent_1.default.countDocuments({ guildId, type: 'member_joined', createdAt: { $gte: since } }),
            PlatformEvent_1.default.countDocuments({ guildId, type: 'member_left', createdAt: { $gte: since } }),
            PlatformEvent_1.default.countDocuments({ guildId, type: 'command_error', createdAt: { $gte: since } }),
            GuildTicket_1.default.countDocuments({ guildId, status: 'open' }),
            GuildTicket_1.default.countDocuments({ guildId, status: 'closed', closedAt: { $gte: since } }),
            ModerationCase_1.default.countDocuments({ guildId, createdAt: { $gte: since } }),
        ]);
        const tone = errors === 0 && tickets < 5 ? '🟢 Stable' : errors > 0 || tickets >= 5 ? '🟠 À surveiller' : '🟡 Normal';
        const net = joins - leaves;
        const notes = [
            `${net >= 0 ? '📈' : '📉'} Évolution membres : ${net >= 0 ? '+' : ''}${net}`,
            `🎫 ${tickets} ticket(s) actuellement ouvert(s), ${closedTickets} clôturé(s) aujourd’hui`,
            `🛡️ ${cases} action(s) de modération sur 24 h`,
            errors === 0 ? '✅ Aucune erreur de commande enregistrée.' : `⚠️ ${errors} erreur(s) de commande à vérifier.`,
        ];
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(OMNIX)
            .setTitle('✦ OMNIX Staff Brief')
            .setDescription(`**${interaction.guild.name}** · dernières 24 heures\nÉtat général : **${tone}**`)
            .addFields({ name: 'Résumé opérationnel', value: notes.join('\n') }, { name: 'Utilisation', value: 'Utilisez `/pulse` pour une lecture plus complète de la santé de la communauté.' })
            .setFooter({ text: 'OMNIX · Staff Intelligence' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },
};
