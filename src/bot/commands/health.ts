import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import mongoose from 'mongoose';

export default {
  data: new SlashCommandBuilder()
    .setName('health')
    .setDescription('Affiche l’état technique détaillé d’OMNIX'),

  async execute(interaction: any) {
    const client: any = interaction.client;
    const mongo = mongoose.connection.readyState === 1;
    const commands = client.commands?.size || 0;
    const events = Array.isArray(client.omnixLoadedEvents) ? client.omnixLoadedEvents.length : 0;
    const load = client.omnixCommandLoadStatus || {};
    const missing = Array.isArray(load.missing) ? load.missing : [];
    const metrics = client.omnixCommandMetrics instanceof Map ? [...client.omnixCommandMetrics.values()] : [];
    const commandFailures = metrics.reduce((sum: number, metric: any) => sum + Number(metric.failures || 0), 0);
    const commandUses = metrics.reduce((sum: number, metric: any) => sum + Number(metric.uses || 0), 0);
    const status = mongo && client.isReady() && commands > 0 && missing.length === 0 ? 'ONLINE' : 'DEGRADED';

    const embed = new EmbedBuilder()
      .setTitle(`OMNIX · ${status}`)
      .setColor(status === 'ONLINE' ? 0x10b981 : 0xf59e0b)
      .addFields(
        { name: 'Discord', value: client.isReady() ? '🟢 Connecté' : '🔴 Déconnecté', inline: true },
        { name: 'MongoDB', value: mongo ? '🟢 Connectée' : '🔴 Indisponible', inline: true },
        { name: 'Commandes chargées', value: String(commands), inline: true },
        { name: 'Fichiers découverts', value: String(load.discovered || commands), inline: true },
        { name: 'Événements', value: String(events), inline: true },
        { name: 'Commandes exécutées', value: String(commandUses), inline: true },
        { name: 'Erreurs de commandes', value: commandFailures ? `⚠️ ${commandFailures}` : '🟢 0', inline: true },
        { name: 'Fichiers non chargés', value: missing.length ? `⚠️ ${missing.length}` : '🟢 0', inline: true },
        { name: 'Latence', value: `${Math.round(Number(client.ws?.ping ?? 0))} ms`, inline: true },
      )
      .setFooter({ text: `${interaction.guild?.name ?? 'OMNIX'} · diagnostic réel` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
