"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('channel-info')
        .setDescription('Affiche les informations d’un salon')
        .addChannelOption(option => option
        .setName('salon')
        .setDescription('Salon à consulter')
        .setRequired(false)),
    async execute(interaction) {
        const channel = interaction.options.getChannel('salon') ??
            interaction.channel;
        if (!channel) {
            return interaction.reply({
                content: '❌ Salon introuvable.',
                ephemeral: true,
            });
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`📺 ${channel.name}`)
            .addFields({
            name: '🆔 ID',
            value: `\`${channel.id}\``,
            inline: true,
        }, {
            name: '📂 Type',
            value: channel.type.toString(),
            inline: true,
        }, {
            name: '📁 Catégorie',
            value: 'parent' in channel && channel.parent
                ? channel.parent.name
                : 'Aucune',
            inline: true,
        }, {
            name: '📅 Création',
            value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:F>`,
            inline: false,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
