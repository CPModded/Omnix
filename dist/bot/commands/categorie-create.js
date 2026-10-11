"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('category-create')
        .setDescription('Crée une catégorie')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels)
        .addStringOption(option => option
        .setName('nom')
        .setDescription('Nom de la catégorie')
        .setMaxLength(100)
        .setRequired(true)),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({
                content: '❌ Serveur introuvable.',
                ephemeral: true,
            });
        }
        const name = interaction.options.getString('nom', true);
        const category = await guild.channels.create({
            name,
            type: discord_js_1.ChannelType.GuildCategory,
            reason: `Créée par ${interaction.user.tag}`,
        });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('📁 Catégorie créée')
            .setDescription(`La catégorie **${category.name}** a été créée.`)
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
