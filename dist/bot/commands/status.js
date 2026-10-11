"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const mongoose_1 = __importDefault(require("mongoose"));
const os_1 = __importDefault(require("os"));
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('status')
        .setDescription('Affiche l\'état complet de l\'infrastructure OMNIX.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator),
    async execute({ interaction }) {
        await interaction.deferReply();
        // 1. Calcul de la mémoire
        const totalMem = (os_1.default.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeMem = (os_1.default.freemem() / 1024 / 1024 / 1024).toFixed(2);
        const usedMem = (parseFloat(totalMem) - parseFloat(freeMem)).toFixed(2);
        const memPercentage = ((parseFloat(usedMem) / parseFloat(totalMem)) * 100).toFixed(0);
        // 2. Calcul du CPU (Uptime et Load)
        const uptime = os_1.default.uptime();
        const days = Math.floor(uptime / (24 * 3600));
        const hours = Math.floor((uptime % (24 * 3600)) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const uptimeStr = `${days}j ${hours}h ${minutes}m`;
        const cpuLoad = os_1.default.loadavg()[0].toFixed(2);
        // 3. Statut Database (Mongoose)
        const dbStatus = mongoose_1.default.connection.readyState === 1 ? '🟢 Connecté' : '🔴 Déconnecté';
        // 4. Latence API Discord
        const botPing = interaction.client.ws.ping;
        const statusEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('📊 ÉTAT DU SYSTÈME OMNIX')
            .setColor(0x06b6d4)
            .addFields({ name: '🌐 Services API', value: `🤖 Discord Gateway : \`${botPing}ms\`\n🗄️ Base de données : \`${dbStatus}\``, inline: false }, { name: '💻 Serveur d\'Hébergement', value: `⏱️ Uptime : \`${uptimeStr}\`\n🧠 Mémoire RAM : \`${usedMem} GB / ${totalMem} GB\` (${memPercentage}%)\n⚡ Charge CPU (Load) : \`${cpuLoad}\``, inline: false })
            .setFooter({ text: 'OMNIX Monitoring' })
            .setTimestamp();
        await interaction.editReply({ embeds: [statusEmbed] });
    }
};
