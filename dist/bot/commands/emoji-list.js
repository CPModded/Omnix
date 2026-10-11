"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('emoji-list')
        .setDescription('Affiche les emojis du serveur'),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const emojis = [...guild.emojis.cache.values()];
        const animated = emojis.filter(emoji => emoji.animated).length;
        const normal = emojis.length - animated;
        const list = emojis
            .slice(0, 40)
            .map(emoji => `${emoji} — \`${emoji.name}\``)
            .join('\n');
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`😀 Emojis — ${guild.name}`)
            .setDescription(list || 'Aucun emoji personnalisé.')
            .addFields({
            name: '📊 Total',
            value: `${emojis.length}`,
            inline: true,
        }, {
            name: '🖼️ Statiques',
            value: `${normal}`,
            inline: true,
        }, {
            name: '🎞️ Animés',
            value: `${animated}`,
            inline: true,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
