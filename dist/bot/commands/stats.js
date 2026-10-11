"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const systemMonitor_1 = require("../../utils/systemMonitor");
const statsCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('stats')
        .setDescription('Affiche les statistiques réelles de performance et d\'activité du Bot OMNIX'),
    async execute({ interaction }) {
        await interaction.deferReply();
        try {
            // Collecte dynamique des métriques du système et de la base de données
            const metrics = await systemMonitor_1.SystemMonitor.getStats();
            // Formater la durée d'Uptime du processus
            const seconds = Math.floor(metrics.bot.uptime % 60);
            const minutes = Math.floor((metrics.bot.uptime / 60) % 60);
            const hours = Math.floor((metrics.bot.uptime / 3600) % 24);
            const days = Math.floor(metrics.bot.uptime / 86400);
            const uptimeStr = `${days}j ${hours}h ${minutes}m ${seconds}s`;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📊 STATISTIQUES D\'ACTIVITÉ OMNIX')
                .setColor(0x06b6d4) // Couleur Cyan néon
                .addFields({ name: '📁 Serveurs connectés', value: `\`${metrics.bot.guildsCount}\` serveurs`, inline: true }, { name: '👤 Utilisateurs enregistrés', value: `\`${metrics.database.totalUsers}\` membres`, inline: true }, { name: '⚡ Latence réseau', value: `\`${metrics.bot.ping} ms\``, inline: true }, { name: '⏳ Temps de fonctionnement (Uptime)', value: `\`${uptimeStr}\``, inline: false }, { name: '💾 RAM utilisée', value: `\`${metrics.system.freeMem}Mo / ${metrics.system.totalMem}Mo\` (${metrics.system.memUsagePercent}%)`, inline: true }, { name: '🧠 Version Moteur', value: '`OMNIX Core v2.4 (TypeScript)`', inline: true })
                .setFooter({ text: 'Données en temps réel extraites de MongoDB & Node.js' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            console.error('[Stats Command Error] :', error.message);
            await interaction.editReply({
                content: "❌ Impossible d'extraire les statistiques réelles du bot pour le moment."
            });
        }
    }
};
exports.default = statsCommand;
