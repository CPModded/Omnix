"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('channel-list')
        .setDescription('Affiche la liste des salons'),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const text = guild.channels.cache.filter(channel => channel.type === discord_js_1.ChannelType.GuildText);
        const voice = guild.channels.cache.filter(channel => channel.type === discord_js_1.ChannelType.GuildVoice);
        const categories = guild.channels.cache.filter(channel => channel.type === discord_js_1.ChannelType.GuildCategory);
        const announcements = guild.channels.cache.filter(channel => channel.type === discord_js_1.ChannelType.GuildAnnouncement);
        const forums = guild.channels.cache.filter(channel => channel.type === discord_js_1.ChannelType.GuildForum);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`📺 Salons — ${guild.name}`)
            .addFields({
            name: '💬 Textuels',
            value: `${text.size}`,
            inline: true,
        }, {
            name: '🔊 Vocaux',
            value: `${voice.size}`,
            inline: true,
        }, {
            name: '📢 Annonces',
            value: `${announcements.size}`,
            inline: true,
        }, {
            name: '🗂️ Catégories',
            value: `${categories.size}`,
            inline: true,
        }, {
            name: '💭 Forums',
            value: `${forums.size}`,
            inline: true,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
