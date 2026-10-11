"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const guildConfig_1 = require("../utils/guildConfig");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('economy')
        .setDescription('Affiche le statut du système économique OMNIX.'),
    async execute(interaction) {
        /* =====================================================
           SERVEUR
        ===================================================== */
        if (!interaction.guildId) {
            await interaction.reply({
                content: '❌ Cette commande doit être utilisée sur un serveur.',
                flags: 64,
            });
            return;
        }
        /* =====================================================
           CONFIGURATION
        ===================================================== */
        const config = await (0, guildConfig_1.getGuildConfig)(interaction.guildId);
        /* =====================================================
           MODULE
        ===================================================== */
        const economy = config.modules?.economy;
        const enabled = Boolean(economy?.enabled);
        /* =====================================================
           EMBED
        ===================================================== */
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('💰 Économie OMNIX')
            .setDescription(enabled
            ? 'Le système économique est actuellement **activé** sur ce serveur.'
            : 'Le système économique est actuellement **désactivé** sur ce serveur.')
            .addFields({
            name: 'Statut',
            value: enabled
                ? '🟢 Activé'
                : '🔴 Désactivé',
            inline: true,
        })
            .addFields({
            name: 'Serveur',
            value: interaction.guild?.name ??
                'Serveur Discord',
            inline: true,
        })
            .setTimestamp();
        await interaction.reply({
            embeds: [
                embed,
            ],
        });
    },
};
