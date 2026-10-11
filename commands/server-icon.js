"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('server-icon')
        .setDescription('Affiche l’icône du serveur')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const icon = guild.iconURL({
            size: 4096,
            extension: 'png',
        });
        if (!icon) {
            return interaction.reply({
                content: '❌ Ce serveur ne possède pas d’icône.',
                ephemeral: true,
            });
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`🖼️ Icône de ${guild.name}`)
            .setImage(icon)
            .setURL(icon)
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
