"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Affiche l’avatar d’un utilisateur')
        .addUserOption(option => option
        .setName('membre')
        .setDescription('Utilisateur ciblé')
        .setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('membre') ??
            interaction.user;
        const avatar = user.displayAvatarURL({
            size: 4096,
        });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`🖼️ Avatar de ${user.tag}`)
            .setImage(avatar)
            .setURL(avatar)
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
