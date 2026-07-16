import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../types';
import mongoose from 'mongoose';
import os from 'os';

export default {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Affiche l\'état complet de l\'infrastructure OMNIX.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute({ interaction }) {
    await interaction.deferReply();

    // 1. Calcul de la mémoire
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const usedMem = (parseFloat(totalMem) - parseFloat(freeMem)).toFixed(2);
    const memPercentage = ((parseFloat(usedMem) / parseFloat(totalMem)) * 100).toFixed(0);

    // 2. Calcul du CPU (Uptime et Load)
    const uptime = os.uptime();
    const days = Math.floor(uptime / (24 * 3600));
    const hours = Math.floor((uptime % (24 * 3600)) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const uptimeStr = `${days}j ${hours}h ${minutes}m`;
    const cpuLoad = os.loadavg()[0].toFixed(2);

    // 3. Statut Database (Mongoose)
    const dbStatus = mongoose.connection.readyState === 1 ? '🟢 Connecté' : '🔴 Déconnecté';

    // 4. Latence API Discord
    const botPing = interaction.client.ws.ping;

    const statusEmbed = new EmbedBuilder()
      .setTitle('📊 ÉTAT DU SYSTÈME OMNIX')
      .setColor(0x06b6d4)
      .addFields(
        { name: '🌐 Services API', value: `🤖 Discord Gateway : \`${botPing}ms\`\n🗄️ Base de données : \`${dbStatus}\``, inline: false },
        { name: '💻 Serveur d\'Hébergement', value: `⏱️ Uptime : \`${uptimeStr}\`\n🧠 Mémoire RAM : \`${usedMem} GB / ${totalMem} GB\` (${memPercentage}%)\n⚡ Charge CPU (Load) : \`${cpuLoad}\``, inline: false }
      )
      .setFooter({ text: 'OMNIX Monitoring' })
      .setTimestamp();

    await interaction.editReply({ embeds: [statusEmbed] });
  }
} as Command;