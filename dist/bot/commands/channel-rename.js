"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('channel-rename')
        .setDescription('Renomme un salon')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels)
        .addChannelOption(option => option
        .setName('salon')
        .setDescription('Salon à renommer')
        .setRequired(true))
        .addStringOption(option => option
        .setName('nom')
        .setDescription('Nouveau nom')
        .setMaxLength(100)
        .setRequired(true)),
    async execute(interaction) {
        const channel = interaction.options.getChannel('salon', true);
        const newName = interaction.options.getString('nom', true);
        const oldName = channel.name;
        await channel.setName(newName, `Renommé par ${interaction.user.tag}`);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('✏️ Salon renommé')
            .addFields({
            name: 'Avant',
            value: oldName,
            inline: true,
        }, {
            name: 'Après',
            value: newName,
            inline: true,
        })
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
