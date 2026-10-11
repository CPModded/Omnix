"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('server-banner')
        .setDescription('Affiche la bannière du serveur')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const banner = guild.bannerURL({
            size: 4096,
            extension: 'png',
        });
        if (!banner) {
            return interaction.reply({
                content: '❌ Ce serveur ne possède pas de bannière.',
                ephemeral: true,
            });
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`🖼️ Bannière de ${guild.name}`)
            .setImage(banner)
            .setURL(banner)
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
