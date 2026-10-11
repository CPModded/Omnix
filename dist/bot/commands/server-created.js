"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('server-created')
        .setDescription('Affiche la date de création du serveur'),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const timestamp = Math.floor(guild.createdTimestamp / 1000);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`📅 Création de ${guild.name}`)
            .setDescription(`Ce serveur a été créé le <t:${timestamp}:F>.\n\n` +
            `Il existe depuis <t:${timestamp}:R>.`)
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
