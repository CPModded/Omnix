"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('server-info')
        .setDescription('Affiche les informations du serveur'),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const owner = await guild.fetchOwner().catch(() => null);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`🏠 ${guild.name}`)
            .setThumbnail(guild.iconURL({
            size: 512,
        }) ?? null)
            .addFields({
            name: '👑 Propriétaire',
            value: owner
                ? `${owner.user.tag}\n\`${owner.id}\``
                : 'Inconnu',
            inline: true,
        }, {
            name: '👥 Membres',
            value: `${guild.memberCount}`,
            inline: true,
        }, {
            name: '💬 Salons',
            value: `${guild.channels.cache.size}`,
            inline: true,
        }, {
            name: '🎭 Rôles',
            value: `${guild.roles.cache.size}`,
            inline: true,
        }, {
            name: '🚀 Boosts',
            value: `${guild.premiumSubscriptionCount ?? 0}`,
            inline: true,
        }, {
            name: '📅 Création',
            value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
            inline: true,
        }, {
            name: '🆔 ID',
            value: `\`${guild.id}\``,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
