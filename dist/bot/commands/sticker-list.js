"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('sticker-list')
        .setDescription('Affiche les stickers du serveur'),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const stickers = [...guild.stickers.cache.values()];
        const list = stickers
            .map(sticker => `**${sticker.name}** — \`${sticker.id}\``)
            .join('\n');
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`🏷️ Stickers — ${guild.name}`)
            .setDescription(list || 'Aucun sticker personnalisé.')
            .addFields({
            name: '📊 Total',
            value: `${stickers.length}`,
            inline: true,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
