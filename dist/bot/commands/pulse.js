"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const GuildTicket_1 = __importDefault(require("../../models/GuildTicket"));
const ModerationCase_1 = __importDefault(require("../../models/ModerationCase"));
const PlatformEvent_1 = __importDefault(require("../../models/PlatformEvent"));
const GuildConfig_1 = __importDefault(require("../../models/GuildConfig"));
const OMNIX = 0x7c5cff;
function status(value) {
    return value ? '🟢 Actif' : '⚪ Inactif';
}
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('pulse')
        .setDescription('Donne une lecture instantanée de la santé de la communauté')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ Cette commande doit être utilisée dans un serveur.', flags: 64 });
        }
        await interaction.deferReply({ flags: 64 });
        const guildId = interaction.guild.id;
        const [config, openTickets, recentCases, joins, leaves, commandErrors, commands] = await Promise.all([
            GuildConfig_1.default.findOne({ guildId }).lean(),
            GuildTicket_1.default.countDocuments({ guildId, status: 'open' }),
            ModerationCase_1.default.countDocuments({ guildId, createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
            PlatformEvent_1.default.countDocuments({ guildId, type: 'member_joined', createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
            PlatformEvent_1.default.countDocuments({ guildId, type: 'member_left', createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
            PlatformEvent_1.default.countDocuments({ guildId, type: 'command_error', createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
            PlatformEvent_1.default.countDocuments({ guildId, type: 'command_executed', createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
        ]);
        const modules = config?.modules || {};
        const enabled = Object.values(modules).filter((module) => module?.enabled === true).length;
        const total = Object.keys(modules).length;
        const premium = Boolean(config?.premium?.isPremium && (!config?.premium?.expiresAt || new Date(config.premium.expiresAt).getTime() > Date.now()));
        const recommendations = [];
        if (!config)
            recommendations.push('Synchroniser la configuration avec le Dashboard.');
        if (!modules.logs?.enabled)
            recommendations.push('Activer les logs pour garder une trace des actions importantes.');
        if (!modules.welcome?.enabled)
            recommendations.push('Activer le Welcomer pour améliorer l’arrivée des nouveaux membres.');
        if (!modules.tickets?.enabled)
            recommendations.push('Activer les tickets si votre communauté reçoit des demandes de support.');
        if (commandErrors > 0)
            recommendations.push(`${commandErrors} erreur(s) de commande sur les 7 derniers jours : consulter les logs.`);
        if (openTickets >= 5)
            recommendations.push(`${openTickets} tickets ouverts : votre équipe support mérite probablement un coup de main.`);
        if (recentCases >= 20)
            recommendations.push(`${recentCases} actions de modération cette semaine : vérifier les règles AutoMod/Anti-Spam.`);
        if (recommendations.length === 0)
            recommendations.push('Aucune alerte majeure détectée. Continuez à surveiller l’activité de la communauté.');
        const activity = commands + joins + leaves;
        const score = Math.max(0, Math.min(100, 40 + (config ? 15 : 0) + (enabled >= Math.max(1, Math.ceil(total * 0.5)) ? 15 : 0) + (modules.logs?.enabled ? 10 : 0) + (commandErrors === 0 ? 10 : 0) + (openTickets < 5 ? 10 : 0)));
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(OMNIX)
            .setTitle('✦ OMNIX Pulse')
            .setDescription(`**Lecture de ${interaction.guild.name}**\nVotre communauté est à **${score}/100** sur les indicateurs actuellement disponibles.`)
            .addFields({ name: '📡 Activité · 7 jours', value: `Commandes **${commands}**\nArrivées **${joins}** · Départs **${leaves}**`, inline: true }, { name: '🛡️ Sécurité', value: `Modération **${recentCases}**\nErreurs **${commandErrors}**`, inline: true }, { name: '🎫 Support', value: `Tickets ouverts **${openTickets}**\nConfiguration **${status(Boolean(config))}**`, inline: true }, { name: '⚙️ Modules', value: `**${enabled}/${total}** activés\nPremium **${premium ? '✨ Actif' : 'Standard'}**`, inline: true }, { name: '🧭 Prochaines actions', value: recommendations.slice(0, 5).map((item) => `• ${item}`).join('\n'), inline: false })
            .setFooter({ text: 'OMNIX · Community Intelligence' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },
};
