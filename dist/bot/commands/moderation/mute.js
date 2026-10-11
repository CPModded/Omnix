"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('mute')
        .setDescription('Rend un membre muet dans un salon vocal')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.MuteMembers)
        .addUserOption(option => option
        .setName('membre')
        .setDescription('Membre à rendre muet')
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
        await member.voice.setMute(true, `Mute vocal par ${interaction.user.tag}`);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('🔇 Membre mute')
            .setDescription(`${member} est maintenant muet.`)
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
