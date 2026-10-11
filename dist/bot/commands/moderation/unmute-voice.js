"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('unmute-voice')
        .setDescription('Retire le mute vocal d’un membre')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.MuteMembers)
        .addUserOption(option => option
        .setName('membre')
        .setDescription('Membre ciblé')
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
        await member.voice.setMute(false, `Unmute vocal par ${interaction.user.tag}`);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('🔊 Mute vocal retiré')
            .setDescription(`${member} peut maintenant parler.`)
            .setTimestamp();
        return interaction.reply({
            embeds: [embed],
        });
    },
};
