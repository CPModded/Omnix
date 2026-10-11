"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('disconnect')
        .setDescription('Déconnecte un membre d’un salon vocal')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.MoveMembers)
        .addUserOption(option => option
        .setName('membre')
        .setDescription('Membre à déconnecter')
        .setRequired(true)),
    async execute(interaction) {
        const member = interaction.options.getMember('membre');
        if (!member || !('voice' in member)) {
            return interaction.reply({
                content: '❌ Membre introuvable.',
                ephemeral: true,
            });
        }
        if (!member.voice.channel) {
            return interaction.reply({
                content: '❌ Ce membre n’est pas dans un salon vocal.',
                ephemeral: true,
            });
        }
        await member.voice.disconnect(`Déconnexion par ${interaction.user.tag}`);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xffa500)
            .setTitle('📤 Membre déconnecté')
            .setDescription(`${member} a été déconnecté du vocal.`)
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
