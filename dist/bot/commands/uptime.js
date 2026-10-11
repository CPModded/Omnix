"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;
    const parts = [];
    if (days)
        parts.push(`${days}j`);
    if (hours)
        parts.push(`${hours}h`);
    if (minutes)
        parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
}
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('uptime')
        .setDescription('Affiche le temps de fonctionnement d’OMNIX'),
    async execute(interaction) {
        const uptime = Math.floor(interaction.client.uptime / 1000);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('⏱️ Uptime OMNIX')
            .setDescription(`OMNIX fonctionne depuis **${formatUptime(uptime)}**.`)
            .addFields({
            name: '🕐 Depuis',
            value: `<t:${Math.floor((Date.now() - interaction.client.uptime) / 1000)}:F>`,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
