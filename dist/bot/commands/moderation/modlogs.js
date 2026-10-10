"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('modlogs')
        .setDescription('Affiche les dernières actions de modération')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ViewAuditLog)
        .addIntegerOption(option => option
        .setName('nombre')
        .setDescription('Nombre d’actions à afficher')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false)),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Cette commande doit être utilisée sur un serveur.',
                ephemeral: true,
            });
        }
        const amount = interaction.options.getInteger('nombre') ?? 10;
        const logs = await guild
            .fetchAuditLogs({
            limit: amount,
        })
            .catch(() => null);
        if (!logs) {
            return interaction.reply({
                content: '❌ Impossible de récupérer les journaux d’audit.',
                ephemeral: true,
            });
        }
        const entries = [...logs.entries.values()];
        if (!entries.length) {
            return interaction.reply({
                content: '📋 Aucun journal récent trouvé.',
                ephemeral: true,
            });
        }
        const lines = entries.map((entry, index) => {
            const action = entry.actionType;
            let actionName = 'Action';
            switch (entry.action) {
                case discord_js_1.AuditLogEvent.MemberBanAdd:
                    actionName = '🔨 Bannissement';
                    break;
                case discord_js_1.AuditLogEvent.MemberKick:
                    actionName = '👢 Expulsion';
                    break;
                case discord_js_1.AuditLogEvent.MemberUpdate:
                    actionName = '👤 Modification membre';
                    break;
                case discord_js_1.AuditLogEvent.ChannelCreate:
                    actionName = '📺 Création salon';
                    break;
                case discord_js_1.AuditLogEvent.ChannelDelete:
                    actionName = '🗑️ Suppression salon';
                    break;
                case discord_js_1.AuditLogEvent.RoleCreate:
                    actionName = '🎭 Création rôle';
                    break;
                case discord_js_1.AuditLogEvent.RoleDelete:
                    actionName = '🗑️ Suppression rôle';
                    break;
                default:
                    actionName = `⚙️ Action ${action}`;
            }
            const executor = entry.executor
                ? entry.executor.tag
                : 'Inconnu';
            return (`**${index + 1}. ${actionName}**\n` +
                `👤 Auteur : **${executor}**\n` +
                `🆔 ID : \`${entry.id}\``);
        });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('📋 Journaux de modération')
            .setDescription(lines.join('\n\n'))
            .setFooter({
            text: `OMNIX • ${guild.name}`,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
