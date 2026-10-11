"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('channel-move')
        .setDescription('Déplace un salon dans une catégorie')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels)
        .addChannelOption(option => option
        .setName('salon')
        .setDescription('Salon à déplacer')
        .setRequired(true))
        .addChannelOption(option => option
        .setName('categorie')
        .setDescription('Nouvelle catégorie')
        .addChannelTypes(discord_js_1.ChannelType.GuildCategory)
        .setRequired(true)),
    async execute(interaction) {
        const channel = interaction.options.getChannel('salon', true);
        const category = interaction.options.getChannel('categorie', true);
        if (!channel.isTextBased() && !channel.isVoiceBased()) {
            return interaction.reply({
                content: '❌ Ce salon ne peut pas être déplacé.',
                ephemeral: true,
            });
        }
        await channel.setParent(category.id, {
            lockPermissions: false,
        });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('📂 Salon déplacé')
            .setDescription(`${channel} a été déplacé dans **${category.name}**.`)
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
